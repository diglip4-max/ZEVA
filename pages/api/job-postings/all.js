import dbConnect from "../../../lib/database";
import "../../../models/Users";
import JobPosting from "../../../models/JobPosting";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  await dbConnect();

  const { location, jobType, department, skills, salary, time, experience, jobId } = req.query;

  // ✅ Always only approved + active
  const filters = { 
    isActive: true,
    status: "approved"
  };

  // ✅ Normalize text helper
  const normalize = (str) => str.replace(/[\s\-.]/g, "").toLowerCase();

  // ✅ Job type
  if (jobType?.trim()) {
    filters.jobType = { $regex: jobType.trim(), $options: "i" };
  }

  // ✅ Department
  if (department?.trim()) {
    filters.department = { $regex: department.trim(), $options: "i" };
  }

  // ✅ Job ID
  if (jobId?.trim()) {
    filters._id = jobId.trim();
  }

  // ✅ Skills (comma separated, case-insensitive)
  if (skills?.trim()) {
    const skillsArray = Array.isArray(skills)
      ? skills
      : skills.split(",").map(s => s.trim()).filter(Boolean);

    filters.skills = { $in: skillsArray.map(skill => new RegExp(skill, "i")) };
  }

  // ✅ Time filter (last 7 days)
  if (time === "week") {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    filters.createdAt = { $gte: oneWeekAgo };
  }

  try {
    let jobs = await JobPosting.find(filters)
      .populate("postedBy", "username role")
      .sort({ createdAt: -1 })
      .lean();

    // ✅ Location normalization check (real fuzzy match)
    if (location?.trim()) {
      const normalizedQuery = normalize(location);
      jobs = jobs.filter(
        job => job.location && normalize(job.location).includes(normalizedQuery)
      );
    }

    // ✅ Experience filter (range based, now AFTER jobs are fetched)
   // ✅ Experience filter (range + "Fresher")
if (experience?.trim()) {
  let min = 0, max = Infinity;
  const expFilter = experience.trim();

  switch (expFilter) {
    case "fresher":
      min = 0; max = 0; break; // treat Fresher as 0 years
    case "1-2":
      min = 1; max = 2; break;
    case "2-4":
      min = 2; max = 4; break;
    case "4-6":
      min = 4; max = 6; break;
    case "7+":
      min = 7; max = Infinity; break;
  }

  jobs = jobs.filter(job => {
    if (!job.experience) return false;

    const expStr = job.experience.toString().toLowerCase();

    // direct fresher match
    if (expFilter === "fresher" && expStr.includes("fresher")) return true;

    // numeric extraction
    const expNum = parseInt(expStr.match(/\d+/)?.[0] || "0", 10);
    return expNum >= min && expNum <= max;
  });
}


    // ✅ Salary filter (range check instead of exact match)
    if (salary?.trim()) {
      const salaryNumber = parseInt(salary.trim(), 10);
      jobs = jobs.filter(job => {
        if (!job.salary) return false;

        const parts = job.salary.split("-").map(s => parseInt(s.trim(), 10)).filter(Boolean);
        if (parts.length === 2) {
          return salaryNumber >= parts[0] && salaryNumber <= parts[1];
        } else if (parts.length === 1) {
          return salaryNumber === parts[0];
        }
        return false;
      });
    }

    res.status(200).json({ success: true, jobs });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ success: false, error: "Failed to fetch jobs" });
  }
}
