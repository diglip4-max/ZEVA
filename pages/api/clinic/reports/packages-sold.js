import dbConnect from "../../../../lib/database";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser, checkClinicPermission } from "../../lead-ms/permissions-helper";
import mongoose from "mongoose";
import Billing from "../../../../models/Billing";
import PatientRegistration from "../../../../models/PatientRegistration";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    await dbConnect();
  } catch {
    return res.status(500).json({ success: false, message: "Database connection failed" });
  }

  let user;
  try {
    user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!["clinic", "agent", "doctor", "doctorStaff", "staff", "admin"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  const { clinicId, error: clinicError } = await getClinicIdFromUser(user);
  if (clinicError && user.role !== "admin") {
    return res.status(403).json({ success: false, message: clinicError });
  }

  const moduleKey = "clinic_reporting";
  const { hasPermission } = await checkClinicPermission(clinicId, moduleKey, "read");
  if (!hasPermission) {
    return res.status(403).json({ success: false, message: "You do not have permission to view reports" });
  }

  try {
    const { startDate, endDate, page = "1", limit = "20", doctorId, departmentId, salesStaffId, clinicId: selectedClinicId, paymentMethod, getAll, includeUnpaid, doctorName } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = getAll ? Number.MAX_SAFE_INTEGER : Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = getAll ? 0 : (pageNum - 1) * pageSize;
    // When includeUnpaid=true (used by the KPI detail modal), also pull package
    // records from PatientRegistration that have no billing yet (unpaid/partial).
    // Default behavior (main report / export) is unchanged when the flag is absent.
    const shouldIncludeUnpaid = includeUnpaid === "true" || includeUnpaid === "1";

    const match = { service: "Package" };
    if (user.role !== "admin") {
      match.clinicId = new mongoose.Types.ObjectId(String(clinicId));
    } else if (selectedClinicId) {
      match.clinicId = new mongoose.Types.ObjectId(String(selectedClinicId));
    }
    if (paymentMethod) {
      match.paymentMethod = paymentMethod;
    }
    // Normalize dates to local start-of-day / end-of-day so billings made later
    // in the day are still included (matches revenue.js behavior)
    const startAt = startDate
      ? new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth(), new Date(startDate).getDate(), 0, 0, 0, 0)
      : null;
    const endAt = endDate
      ? new Date(new Date(endDate).getFullYear(), new Date(endDate).getMonth(), new Date(endDate).getDate(), 23, 59, 59, 999)
      : null;

    // For package reports, filter by assignedDate from PatientRegistration packages
    // to match the behavior of sales-staff-performance API and ensure
    // KPI cards and table show consistent data based on the same date range.
    let packageAssignmentFilter = null;
    if (startAt || endAt) {
      packageAssignmentFilter = {};
      if (startAt) packageAssignmentFilter.$gte = startAt;
      if (endAt) packageAssignmentFilter.$lte = endAt;
    }

    // Also keep invoicedDate on match for summary/count pipelines (backward compat)
    if (startAt || endAt) {
      match.invoicedDate = {};
      if (startAt) match.invoicedDate.$gte = startAt;
      if (endAt) match.invoicedDate.$lte = endAt;
      if (Object.keys(match.invoicedDate).length === 0) delete match.invoicedDate;
    }

    // Helper: build the comprehensive effectiveDepartmentId pipeline stages
    // (service.departmentId -> treatmentServices[0].departmentId -> doctorDepartments[0].clinicDepartmentId)
    // Mirrors the logic in package-performance.js so both endpoints report consistent stats
    const buildDepartmentFilterStages = () => {
      if (!departmentId) return [];
      const deptObjId = new mongoose.Types.ObjectId(String(departmentId));
      return [
        {
          $lookup: {
            from: "doctordepartments",
            localField: "effectiveDoctorId",
            foreignField: "doctorId",
            as: "doctorDepartments",
          },
        },
        // Treatment names from selectedPackageTreatments or treatment field
        {
          $addFields: {
            __treatmentNames: {
              $cond: {
                if: {
                  $gt: [
                    { $size: { $ifNull: ["$selectedPackageTreatments", []] } },
                    0,
                  ],
                },
                then: "$selectedPackageTreatments.treatmentName",
                else: { $cond: { if: "$treatment", then: ["$treatment"], else: [] } },
              },
            },
          },
        },
        {
          $lookup: {
            from: "services",
            let: { tNames: "$__treatmentNames", clinicId: "$clinicId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$clinicId", "$$clinicId"] },
                      { $in: ["$name", "$$tNames"] },
                    ],
                  },
                },
              },
              { $project: { departmentId: 1, name: 1, _id: 0 } },
            ],
            as: "treatmentServices",
          },
        },
        {
          $addFields: {
            effectiveDepartmentId: {
              $ifNull: [
                "$service.departmentId",
                { $arrayElemAt: ["$treatmentServices.departmentId", 0] },
                { $arrayElemAt: ["$doctorDepartments.clinicDepartmentId", 0] },
                null,
              ],
            },
          },
        },
        {
          $match: { effectiveDepartmentId: deptObjId },
        },
      ];
    };

    // First, get all patient registrations with packages in the date range
    // to build a set of valid package assignments
    let validPackageAssignments = null;
    if (packageAssignmentFilter) {
      const prMatch = {};
      if (user.role !== "admin") {
        prMatch.clinicId = new mongoose.Types.ObjectId(String(clinicId));
      } else if (selectedClinicId) {
        prMatch.clinicId = new mongoose.Types.ObjectId(String(selectedClinicId));
      }

      const prPipeline = [
        { $match: prMatch },
        { $unwind: "$packages" },
        {
          $match: {
            "packages.assignedDate": packageAssignmentFilter,
          },
        },
        {
          $group: {
            _id: {
              patientId: "$_id",
              packageName: "$packages.packageName",
            },
          },
        },
      ];

      const prResults = await PatientRegistration.aggregate(prPipeline);
      validPackageAssignments = new Set(
        prResults.map((r) => `${String(r._id.patientId)}__${String(r._id.packageName)}`)
      );
    }

    const pipeline = [
      { $match: { $or: [match, { ...match, service: "Treatment", "unpaidPackagesPaid.0": { $exists: true } }] } },
      {
        $lookup: {
          from: "appointments",
          localField: "appointmentId",
          foreignField: "_id",
          as: "appointment",
        },
      },
      { $unwind: { path: "$appointment", preserveNullAndEmptyArrays: true } },
      // Lookup appointment's service (needed for service.departmentId)
      {
        $lookup: {
          from: "services",
          localField: "appointment.serviceId",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          effectiveDoctorId: {
            $ifNull: ["$doctorId", "$appointment.doctorId"]
          },
          __packageName: {
            $cond: {
              if: { $eq: ["$service", "Treatment"] },
              then: { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] },
              else: "$package"
            }
          }
        }
      }
    ];

    // Doctor filter: when includeUnpaid=true (KPI modal), skip doctorId on Billing
    // pipeline because it matches on treating doctor (effectiveDoctorId), not the
    // person who sold/invoiced the package. The dashboard counts doctor packages
    // using packageSoldBy from sales-staff data, so we match that logic here.
    // When includeUnpaid=false (main report/export), keep the original behavior.
    if (doctorId && !shouldIncludeUnpaid) {
      pipeline.push({
        $match: { effectiveDoctorId: new mongoose.Types.ObjectId(String(doctorId)) },
      });
    }

    if (departmentId) {
      pipeline.push(...buildDepartmentFilterStages());
    }

    // Sales staff filter: always apply to Billing pipeline using invoicedBy (name)
    // so the modal only shows packages invoiced by the selected sales staff.
    // When includeUnpaid=true, the PatientRegistration pipeline also filters by
    // packageSoldBy to capture unpaid packages for the same person.
    if (salesStaffId) {
      // Check if salesStaffId is a valid ObjectId or a name
      const isValidObjectId = mongoose.Types.ObjectId.isValid(salesStaffId) && String(salesStaffId).length === 24;
      
      if (isValidObjectId) {
        // Match by user ID
        pipeline.push({
          $match: { invoicedById: new mongoose.Types.ObjectId(String(salesStaffId)) },
        });
      } else {
        // Match by user name (e.g., "pihu", "muskan")
        pipeline.push({
          $match: { invoicedBy: String(salesStaffId) },
        });
      }
    }

    pipeline.push(
      {
        $addFields: {
          __usedSessions: {
            $sum: {
              $map: {
                input: { $ifNull: ["$selectedPackageTreatments", []] },
                as: "t",
                in: { $ifNull: ["$$t.sessions", 0] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: { patientId: "$patientId", package: "$__packageName" },
          patientId: { $first: "$patientId" },
          packageName: { $first: "$__packageName" },
          // Use paid amount directly. When pending is cleared via treatment pay,
          // Treatment billing's paid field contains the cash collected for the package.
          totalPaid: { $sum: { $ifNull: ["$paid", 0] } },
          totalPending: { $sum: { $ifNull: ["$pending", 0] } },
          sessionsUsed: { $sum: "$__usedSessions" },
          firstPurchaseDate: { $min: "$createdAt" },
          lastActivityDate: { $max: "$createdAt" },
          doctorIds: { $addToSet: "$effectiveDoctorId" },
          // Fields required by the Package Registry table columns (Staff, Branch, Dept)
          soldBy: { $first: "$invoicedBy" },
          clinicId: { $first: "$clinicId" },
          serviceId: { $first: "$appointment.serviceId" },
        },
      },
      // Resolve doctor names
      {
        $lookup: {
          from: "users",
          let: { dids: "$doctorIds" },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$_id", { $ifNull: ["$$dids", []] }] },
              },
            },
            { $project: { _id: 1, name: 1, firstName: 1, lastName: 1 } },
          ],
          as: "doctors",
        },
      },
      {
        $lookup: {
          from: "patientregistrations",
          localField: "patientId",
          foreignField: "_id",
          as: "patient",
        },
      },
      {
        $lookup: {
          from: "packages",
          localField: "packageName",
          foreignField: "name",
          as: "pkg",
        },
      },
      // Branch (clinic) name — Billing carries clinicId
      {
        $lookup: {
          from: "clinics",
          localField: "clinicId",
          foreignField: "_id",
          as: "clinic",
        },
      },
      // Department chain: appointment.serviceId -> service.departmentId -> department.name
      {
        $lookup: {
          from: "services",
          localField: "serviceId",
          foreignField: "_id",
          as: "serviceDoc",
        },
      },
      {
        $addFields: {
          departmentId: {
            $ifNull: [{ $arrayElemAt: ["$serviceDoc.departmentId", 0] }, null],
          },
          // Expiry date mirrors the summary pipeline logic
          // (pkg.endDate / pkg.validityInMonths / +1 year from first purchase)
          expirationDate: {
            $switch: {
              branches: [
                {
                  case: { $ne: [{ $ifNull: [{ $arrayElemAt: ["$pkg.endDate", 0] }, null] }, null] },
                  then: { $arrayElemAt: ["$pkg.endDate", 0] },
                },
                {
                  case: { $gt: [{ $ifNull: [{ $arrayElemAt: ["$pkg.validityInMonths", 0] }, 0] }, 0] },
                  then: {
                    $dateAdd: {
                      startDate: { $ifNull: ["$firstPurchaseDate", new Date()] },
                      unit: "month",
                      amount: { $arrayElemAt: ["$pkg.validityInMonths", 0] },
                    },
                  },
                },
              ],
              default: {
                $dateAdd: {
                  startDate: { $ifNull: ["$firstPurchaseDate", new Date()] },
                  unit: "year",
                  amount: 1,
                },
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "departmentId",
          foreignField: "_id",
          as: "department",
        },
      },
      {
        $project: {
          patientId: 1,
          packageName: 1,
          patientName: {
            $concat: [
              { $ifNull: [{ $arrayElemAt: ["$patient.firstName", 0] }, ""] },
              " ",
              { $ifNull: [{ $arrayElemAt: ["$patient.lastName", 0] }, ""] },
            ],
          },
          phone: { $ifNull: [{ $arrayElemAt: ["$patient.mobileNumber", 0] }, ""] },
          emrNumber: { $ifNull: [{ $arrayElemAt: ["$patient.emrNumber", 0] }, ""] },
          branch: { $ifNull: [{ $arrayElemAt: ["$clinic.name", 0] }, ""] },
          department: { $ifNull: [{ $arrayElemAt: ["$department.name", 0] }, ""] },
          soldBy: { $ifNull: ["$soldBy", ""] },
          totalValue: { $add: [{ $ifNull: ["$totalPaid", 0] }, { $ifNull: ["$totalPending", 0] }] },
          totalSessions: { $ifNull: [{ $arrayElemAt: ["$pkg.totalSessions", 0] }, 0] },
          sessionsUsed: 1,
          remainingSessions: {
            $max: [{ $subtract: [{ $ifNull: [{ $arrayElemAt: ["$pkg.totalSessions", 0] }, 0] }, "$sessionsUsed"] }, 0],
          },
          doctorNames: {
            $map: {
              input: "$doctors",
              as: "d",
              in: {
                $cond: [
                  { $ifNull: ["$$d.name", false] },
                  "$$d.name",
                  {
                    $trim: {
                      input: {
                        $concat: [
                          { $ifNull: ["$$d.firstName", ""] },
                          " ",
                          { $ifNull: ["$$d.lastName", ""] },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
          paymentStatus: {
            $cond: [{ $gt: ["$totalPending", 0] }, "Partly Paid", "Paid"],
          },
          totalPaid: 1,
          totalPending: 1,
          firstPurchaseDate: 1,
          lastActivityDate: 1,
          expirationDate: 1,
        },
      },
      {
        $addFields: {
          doctorName: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ["$doctorNames", []] } }, 0] },
              { $reduce: { input: "$doctorNames", initialValue: "", in: { $cond: [{ $eq: ["$$value", ""] }, "$$this", { $concat: ["$$value", ", ", "$$this"] }] } } },
              // Fallback: use doctorName field from Billing if available and not a dash
              {
                $cond: [
                  {
                    $and: [
                      { $ifNull: ["$doctorName", false] },
                      { $ne: ["$doctorName", ""] },
                      { $ne: ["$doctorName", "—"] },
                      { $ne: ["$doctorName", "-"] }
                    ]
                  },
                  "$doctorName",
                  "Unknown"
                ]
              }
            ],
          },
        },
      },
      { $sort: { totalPaid: -1 } },
      { $skip: skip },
      { $limit: pageSize }
    );

    const rows = await Billing.aggregate(pipeline);

    // Post-process: for rows with doctorName "Unknown", look up doctor name from
    // Treatment billing records that reference this package in unpaidPackagesPaid.
    // This handles cases where the Package billing record has doctorName: "—"
    // but the associated Treatment record has the actual doctor name.
    try {
      const unknownDoctorRows = (rows || []).filter((r) => r.doctorName === "Unknown" && r.patientId && r.packageName);
      if (unknownDoctorRows.length > 0) {
        const treatmentBillings = await Billing.find({
          service: "Treatment",
          "unpaidPackagesPaid.packageName": { $in: unknownDoctorRows.map((r) => r.packageName) },
        }).select("unpaidPackagesPaid doctorName").lean();

        const doctorNameMap = new Map();
        for (const tb of treatmentBillings) {
          for (const upp of (tb.unpaidPackagesPaid || [])) {
            if (upp.packageName && !doctorNameMap.has(upp.packageName)) {
              const docName = tb.doctorName || "";
              if (docName && docName !== "—" && docName !== "-") {
                doctorNameMap.set(upp.packageName, docName);
              }
            }
          }
        }

        for (const row of rows) {
          if (row.doctorName === "Unknown" && doctorNameMap.has(row.packageName)) {
            row.doctorName = doctorNameMap.get(row.packageName);
          }
        }
      }
    } catch (e) {
      console.error("packages-sold doctor lookup error:", e);
    }

    // Post-filter: if we have date-based package assignments, filter the pipeline results
    // to only include packages that were assigned within the date range
    let filteredRows = rows;
    if (validPackageAssignments && validPackageAssignments.size > 0) {
      filteredRows = rows.filter((row) => {
        if (!row.patientId || !row.packageName) return false;
        const key = `${String(row.patientId)}__${String(row.packageName)}`;
        return validPackageAssignments.has(key);
      });
    }

    // Debug logging
    console.log('DEBUG packages-sold rows:', {
      salesStaffId,
      rowsCount: filteredRows?.length || 0,
      firstRow: filteredRows?.[0] ? { packageName: filteredRows[0].packageName, soldBy: filteredRows[0].soldBy } : null
    });

    // ---------------------------------------------------------------------
    // Optional: include unpaid / partially paid packages from PatientRegistration
    // so the KPI detail modal shows the SAME package set that the dashboard
    // cards count. Only triggered when includeUnpaid=true is sent.
    // We dedupe by (patientId + packageName) so a package that already has a
    // billing record is never double-counted.
    // ---------------------------------------------------------------------
    let unpaidRows = [];
    if (shouldIncludeUnpaid) {
      try {
        // Build a lookup table of patientId + packageName already covered by Billing
        const seenKeys = new Set(
          (filteredRows || [])
            .filter((r) => r.patientId && r.packageName)
            .map((r) => `${String(r.patientId)}__${String(r.packageName)}`)
        );

        // Base match for PatientRegistration (clinic scope only)
        const prMatch = {};
        if (user.role !== "admin") {
          prMatch.clinicId = new mongoose.Types.ObjectId(String(clinicId));
        } else if (selectedClinicId) {
          prMatch.clinicId = new mongoose.Types.ObjectId(String(selectedClinicId));
        }

        const prPipeline = [
          { $match: prMatch },
          { $unwind: "$packages" },
          // Only consider packages that actually have a price set
          {
            $match: {
              "packages.totalPrice": { $gt: 0 },
            },
          },
          // Date range based on assignedDate (mirrors sales-staff-performance.js)
          ...(startAt || endAt
            ? [
                {
                  $match: {
                    "packages.assignedDate": {
                      ...(startAt ? { $gte: startAt } : {}),
                      ...(endAt ? { $lte: endAt } : {}),
                    },
                  },
                },
              ]
            : []),
        ];

        // Sales staff filter: match by userId (ObjectId) or by name string
        if (salesStaffId) {
          const isValidObjectId =
            mongoose.Types.ObjectId.isValid(salesStaffId) &&
            String(salesStaffId).length === 24;
          if (isValidObjectId) {
            prPipeline.push({
              $match: {
                "packages.packageSoldByUserId": new mongoose.Types.ObjectId(
                  String(salesStaffId)
                ),
              },
            });
          } else {
            prPipeline.push({
              $match: { "packages.packageSoldBy": String(salesStaffId) },
            });
          }
        }

        // Doctor filter: match by doctorName (passed from frontend) against
        // packages.packageSoldBy – mirrors how the dashboard counts unpaid
        // packages for a doctor via sales-staff data filtered by doctor name.
        if (doctorName && String(doctorName).trim()) {
          prPipeline.push({
            $match: { "packages.packageSoldBy": String(doctorName).trim() },
          });
        }

        prPipeline.push(
          {
            $group: {
              _id: {
                patientId: "$_id",
                packageName: "$packages.packageName",
              },
              patientId: { $first: "$_id" },
              firstName: { $first: "$firstName" },
              lastName: { $first: "$lastName" },
              mobileNumber: { $first: "$mobileNumber" },
              emrNumber: { $first: "$emrNumber" },
              clinicId: { $first: "$clinicId" },
              packageName: { $first: "$packages.packageName" },
              totalPrice: { $sum: { $ifNull: ["$packages.totalPrice", 0] } },
              paidAmount: { $sum: { $ifNull: ["$packages.paidAmount", 0] } },
              paymentStatus: { $first: "$packages.paymentStatus" },
              paymentMethod: { $first: "$packages.paymentMethod" },
              packageSoldBy: { $first: "$packages.packageSoldBy" },
              assignedDate: { $min: "$packages.assignedDate" },
            },
          },
          {
            $project: {
              _id: 0,
              patientId: 1,
              packageName: 1,
              patientName: {
                $concat: [
                  { $ifNull: ["$firstName", ""] },
                  " ",
                  { $ifNull: ["$lastName", ""] },
                ],
              },
              phone: { $ifNull: ["$mobileNumber", ""] },
              emrNumber: { $ifNull: ["$emrNumber", ""] },
              branch: "",
              department: "",
              soldBy: { $ifNull: ["$packageSoldBy", ""] },
              totalPaid: "$paidAmount",
              totalPending: {
                $max: [
                  { $subtract: ["$totalPrice", "$paidAmount"] },
                  0,
                ],
              },
              totalValue: "$totalPrice",
              firstPurchaseDate: "$assignedDate",
              lastActivityDate: "$assignedDate",
              paymentStatus: {
                $cond: [
                  { $lte: ["$paidAmount", 0] },
                  "Unpaid",
                  {
                    $cond: [
                      { $lt: ["$paidAmount", "$totalPrice"] },
                      "Partly Paid",
                      "Paid",
                    ],
                  },
                ],
              },
              sessionsUsed: 0,
              totalSessions: 0,
              remainingSessions: 0,
              doctorNames: [],
              doctorName: "Unknown",
              expirationDate: null,
            },
          }
        );

        const prResults = await PatientRegistration.aggregate(prPipeline);

        // Dedupe against Billing rows (same patient + same package) so we never
        // show a package twice when it already has a billing record.
        unpaidRows = (prResults || []).filter((r) => {
          if (!r.patientId || !r.packageName) return true;
          const key = `${String(r.patientId)}__${String(r.packageName)}`;
          if (seenKeys.has(key)) return false;
          return true;
        });
      } catch (e) {
        console.error("packages-sold includeUnpaid error:", e);
        unpaidRows = [];
      }
    }

    // For count, we need to apply the same filters
    const countPipeline = [
      { $match: match },
      {
        $lookup: {
          from: "appointments",
          localField: "appointmentId",
          foreignField: "_id",
          as: "appointment",
        },
      },
      { $unwind: { path: "$appointment", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "services",
          localField: "appointment.serviceId",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          effectiveDoctorId: {
            $ifNull: ["$doctorId", "$appointment.doctorId"]
          }
        }
      }
    ];

    if (doctorId) {
      countPipeline.push({
        $match: { effectiveDoctorId: new mongoose.Types.ObjectId(String(doctorId)) },
      });
    }

    if (departmentId) {
      countPipeline.push(...buildDepartmentFilterStages());
    }

    if (salesStaffId) {
      // Check if salesStaffId is a valid ObjectId or a name
      const isValidObjectId = mongoose.Types.ObjectId.isValid(salesStaffId) && String(salesStaffId).length === 24;
      
      if (isValidObjectId) {
        countPipeline.push({
          $match: { invoicedById: new mongoose.Types.ObjectId(String(salesStaffId)) },
        });
      } else {
        countPipeline.push({
          $match: { invoicedBy: String(salesStaffId) },
        });
      }
    }

    countPipeline.push(
      {
        $group: {
          _id: { patientId: "$patientId", package: "$package" },
        },
      },
      { $count: "total" }
    );

    const countAgg = await Billing.aggregate(countPipeline);
    const total = countAgg?.[0]?.count || 0;

    // Debug logging for count
    console.log('DEBUG packages-sold count:', { salesStaffId, total, countAggLength: countAgg?.length });

    // When includeUnpaid=true we are fetching ALL rows (getAll or large limit)
    // for the KPI modal. Append the unpaid rows from PatientRegistration so
    // the modal and the dashboard cards reflect the same set of packages.
    if (shouldIncludeUnpaid && unpaidRows.length > 0) {
      filteredRows.push(...unpaidRows);
    }

    // Calculate previous period dates
    let previousStartAt = null;
    let previousEndAt = null;
    if (startAt && endAt) {
      const durationMs = endAt.getTime() - startAt.getTime();
      previousStartAt = new Date(startAt.getTime() - durationMs);
      previousEndAt = new Date(startAt.getTime() - 1);
    } else {
      // Default: previous month if no date range selected
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      previousStartAt = previousMonthStart;
      previousEndAt = previousMonthEnd;
    }

    // Build match for previous period
    const previousMatch = { ...match };
    if (previousStartAt || previousEndAt) {
      previousMatch.invoicedDate = {};
      if (previousStartAt) previousMatch.invoicedDate.$gte = previousStartAt;
      if (previousEndAt) previousMatch.invoicedDate.$lte = previousEndAt;
      if (Object.keys(previousMatch.invoicedDate).length === 0) delete previousMatch.invoicedDate;
    }

    // Helper function to build summary pipeline for a given match
    const buildSummaryPipeline = (matchObj) => {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      const sevenDaysFromNow = new Date(todayStart);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const thirtyDaysFromNow = new Date(todayStart);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      // Build sales staff filter (ObjectId or name)
      const summarySalesStaffFilter = salesStaffId ? (() => {
        const isValidObjectId = mongoose.Types.ObjectId.isValid(salesStaffId) && String(salesStaffId).length === 24;
        return isValidObjectId 
          ? { invoicedById: new mongoose.Types.ObjectId(String(salesStaffId)) }
          : { invoicedBy: String(salesStaffId) };
      })() : null;
      
      return [
        { $match: { $or: [matchObj, { ...matchObj, service: "Treatment", "unpaidPackagesPaid.0": { $exists: true } }] } },
        {
          $lookup: {
            from: "appointments",
            localField: "appointmentId",
            foreignField: "_id",
            as: "appointment",
          },
        },
        { $unwind: { path: "$appointment", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "services",
            localField: "appointment.serviceId",
            foreignField: "_id",
            as: "service",
          },
        },
        { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            effectiveDoctorId: {
              $ifNull: ["$doctorId", "$appointment.doctorId"]
            },
            __usedSessions: {
              $sum: {
                $map: {
                  input: { $ifNull: ["$selectedPackageTreatments", []] },
                  as: "t",
                  in: { $ifNull: ["$$t.sessions", 0] },
                },
              },
            },
            __packageName: {
              $cond: {
                if: { $eq: ["$service", "Treatment"] },
                then: { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] },
                else: "$package"
              }
            }
          }
        },
        ...(doctorId ? [{ $match: { effectiveDoctorId: new mongoose.Types.ObjectId(String(doctorId)) } }] : []),
        ...(departmentId ? buildDepartmentFilterStages() : []),
        ...(salesStaffId ? (() => {
          const isValidObjectId = mongoose.Types.ObjectId.isValid(salesStaffId) && String(salesStaffId).length === 24;
          return isValidObjectId 
            ? [{ $match: { invoicedById: new mongoose.Types.ObjectId(String(salesStaffId)) } }]
            : [{ $match: { invoicedBy: String(salesStaffId) } }];
        })() : []),
        {
          $group: {
            _id: { patientId: "$patientId", package: "$__packageName" },
            // Use paid amount directly. When pending is cleared via treatment pay,
            // Treatment billing's paid field contains the cash collected for the package.
            totalPaid: { $sum: { $ifNull: ["$paid", 0] } },
            totalPending: { $sum: { $ifNull: ["$pending", 0] } },
            sessionsUsed: { $sum: "$__usedSessions" },
            firstPurchaseDate: { $min: "$createdAt" },
          },
        },
        {
          $lookup: {
            from: "packages",
            localField: "_id.package",
            foreignField: "name",
            as: "pkg",
          },
        },
        {
          $addFields: {
            totalSessions: { $ifNull: [{ $arrayElemAt: ["$pkg.totalSessions", 0] }, 0] },
            pkgData: { $arrayElemAt: ["$pkg", 0] },
          }
        },
        {
          $addFields: {
            // Calculate expiration date
            expirationDate: {
              $switch: {
                branches: [
                  // Case 1: Package has explicit endDate
                  {
                    case: { $ne: ["$pkgData.endDate", null] },
                    then: "$pkgData.endDate"
                  },
                  // Case 2: Package has validityInMonths, use firstPurchaseDate + validity
                  {
                    case: { $gt: [{ $ifNull: ["$pkgData.validityInMonths", 0] }, 0] },
                    then: {
                      $dateAdd: {
                        startDate: "$firstPurchaseDate",
                        unit: "month",
                        amount: "$pkgData.validityInMonths"
                      }
                    }
                  }
                ],
                // Default: No expiration or 1 year default
                default: {
                  $dateAdd: {
                    startDate: "$firstPurchaseDate",
                    unit: "year",
                    amount: 1
                  }
                }
              }
            }
          }
        },
        {
          $addFields: {
            isExpired: { $lt: ["$expirationDate", todayStart] },
            isExpiringIn7Days: {
              $and: [
                { $gte: ["$expirationDate", todayStart] },
                { $lte: ["$expirationDate", sevenDaysFromNow] }
              ]
            },
            isExpiringIn30Days: {
              $and: [
                { $gt: ["$expirationDate", sevenDaysFromNow] },
                { $lte: ["$expirationDate", thirtyDaysFromNow] }
              ]
            },
            // Renewal opportunity: expired or expiring in 30 days
            isRenewalOpportunity: {
              $or: [
                { $lt: ["$expirationDate", thirtyDaysFromNow] },
                { $gte: ["$sessionsUsed", "$totalSessions"] }
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            totalPackagesSold: { $sum: 1 },
            totalPaid: { $sum: "$totalPaid" },
            totalPending: { $sum: "$totalPending" },
            totalSessions: { $sum: "$totalSessions" },
            totalUsedSessions: { $sum: "$sessionsUsed" },
            paidPackages: { $sum: { $cond: [{ $lte: ["$totalPending", 0] }, 1, 0] } },
            partiallyPaid: { $sum: { $cond: [{ $and: [{ $gt: ["$totalPending", 0] }, { $gt: ["$totalPaid", 0] }] }, 1, 0] } },
            unpaidPackages: { $sum: { $cond: [{ $lte: ["$totalPaid", 0] }, 1, 0] } },
            activePackages: { $sum: { $cond: [{ $and: [{ $gt: ["$sessionsUsed", 0] }, { $lt: ["$sessionsUsed", "$totalSessions"] }] }, 1, 0] } },
            completedPackages: { $sum: { $cond: [{ $gte: ["$sessionsUsed", "$totalSessions"] }, 1, 0] } },
            unusedPackages: { $sum: { $cond: [{ $lte: ["$sessionsUsed", 0] }, 1, 0] } },
            expiredPackages: { $sum: { $cond: ["$isExpired", 1, 0] } },
            expiring7Days: { $sum: { $cond: ["$isExpiringIn7Days", 1, 0] } },
            expiring30Days: { $sum: { $cond: ["$isExpiringIn30Days", 1, 0] } },
            renewalOpportunities: { $sum: { $cond: ["$isRenewalOpportunity", 1, 0] } },
          },
        },
      ];
    };

    const summaryPipeline = buildSummaryPipeline(match);
    const previousSummaryPipeline = buildSummaryPipeline(previousMatch);

    const summaryAgg = await Billing.aggregate(summaryPipeline);
    const previousSummaryAgg = await Billing.aggregate(previousSummaryPipeline);
    const summary = summaryAgg?.[0] || {
      totalPackagesSold: 0,
      totalPaid: 0,
      totalPending: 0,
      totalSessions: 0,
      totalUsedSessions: 0,
      paidPackages: 0,
      partiallyPaid: 0,
      unpaidPackages: 0,
      activePackages: 0,
      completedPackages: 0,
      unusedPackages: 0,
      expiredPackages: 0,
      expiring7Days: 0,
      expiring30Days: 0,
      renewalOpportunities: 0,
    };
    const previousSummary = previousSummaryAgg?.[0] || {
      totalPackagesSold: 0,
      totalPaid: 0,
      totalPending: 0,
      totalSessions: 0,
      totalUsedSessions: 0,
      paidPackages: 0,
      partiallyPaid: 0,
      unpaidPackages: 0,
      activePackages: 0,
      completedPackages: 0,
      unusedPackages: 0,
      expiredPackages: 0,
      expiring7Days: 0,
      expiring30Days: 0,
      renewalOpportunities: 0,
    };

    // Recompute total so it reflects the merged result set (Billing + PatientRegistration)
    // when includeUnpaid=true. Used only for the pagination block in the response.
    const finalTotal = shouldIncludeUnpaid ? filteredRows.length : total;
    const totalPages = finalTotal > 0 ? Math.ceil(finalTotal / pageSize) : 0;
    return res.status(200).json({
      success: true,
      data: filteredRows,
      summary,
      previousSummary,
      pagination: { page: pageNum, pageSize, total: finalTotal, totalPages, hasNext: skip + filteredRows.length < finalTotal },
    });
  } catch (e) {
    console.error("packages-sold error:", e);
    return res.status(500).json({ success: false, message: "Failed to fetch packages sold" });
  }
}
