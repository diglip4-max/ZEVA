# Appointment Import Guide

## Test CSV Files

Two sample CSV files are provided for testing:

1. **test-appointments-import.csv** - Uses 24-hour time format (09:00, 14:00)
2. **test-appointments-import-alt.csv** - Uses 12-hour time format (09:00 AM, 02:00 PM)

## Before Importing

### Important: Update Doctor and Room Names

**You MUST update the doctor names and room names in the CSV files to match what exists in your system.**

1. Check your existing doctors:
   - Go to the appointment page
   - Note the exact doctor names (e.g., "Dr. John Smith", "Dr. Jane Doe")

2. Check your existing rooms:
   - Note the exact room names (e.g., "Room 1", "Consultation Room", "OPD Room 1")

3. Update the CSV files:
   - Replace "Dr. Smith" with your actual doctor name
   - Replace "Dr. Johnson" with another actual doctor name
   - Replace "Room 1" and "Room 2" with your actual room names

## CSV Format Requirements

### Required Fields (Must be present):
- **Patient Name**: Full name of the patient
- **Patient Phone**: Contact number (10 digits minimum)
- **Doctor Name**: Must exactly match an existing doctor name in your system
- **Room Name**: Must exactly match an existing room name in your system
- **Appointment Date**: Format: YYYY-MM-DD or DD/MM/YYYY
- **Start Time**: Format: HH:MM (24-hour) or HH:MM AM/PM (12-hour)
- **End Time**: Format: HH:MM (24-hour) or HH:MM AM/PM (12-hour)

### Optional Fields:
- **Patient Email**: Email address
- **Patient Gender**: Male, Female, or Other
- **Status**: booked, enquiry, Arrived, Consultation, Cancelled, etc. (defaults to "booked")
- **Follow Type**: first time, follow up, or repeat (defaults to "first time")
- **Notes**: Additional notes about the appointment

## Date Formats Supported

- `YYYY-MM-DD` (e.g., 2024-12-20)
- `DD/MM/YYYY` (e.g., 20/12/2024)
- `DD-MM-YYYY` (e.g., 20-12-2024)
- `YYYY/MM/DD` (e.g., 2024/12/20)

## Time Formats Supported

### 24-Hour Format:
- `09:00` (9:00 AM)
- `14:30` (2:30 PM)
- `15:45` (3:45 PM)

### 12-Hour Format:
- `09:00 AM` or `9:00 AM`
- `02:00 PM` or `2:00 PM`
- `03:45 PM` or `3:45 PM`

## How to Import

1. **Go to Appointment Page**: Navigate to `/clinic/appointment`

2. **Click Import Button**: Click the "Import" button in the header (only visible if you have create permission)

3. **Upload File**: 
   - Click "Click to upload or drag and drop"
   - Select your CSV or Excel file
   - Maximum file size: 5MB

4. **Map Columns** (if needed):
   - The system will try to auto-map columns
   - Review and adjust column mappings if necessary
   - Ensure all required fields are mapped

5. **Preview**: 
   - Review the first 10 rows
   - Check validation stats
   - Fix any errors shown

6. **Import**: 
   - Click "Import X Appointments" button
   - Wait for the import to complete
   - Review the import statistics

## Validation Checks

The system will validate:
- ✅ All required fields are present
- ✅ Doctor name exists in your system
- ✅ Room name exists in your system
- ✅ Date format is valid
- ✅ Time format is valid
- ✅ End time is after start time
- ✅ No overlapping appointments (same doctor, same time)

## Troubleshooting

### "Doctor not found" error:
- Check the exact spelling of doctor names
- Ensure doctor names match exactly (case-sensitive)
- Verify the doctor is active in your system

### "Room not found" error:
- Check the exact spelling of room names
- Ensure room names match exactly (case-sensitive)
- Verify the room exists in your system

### "Invalid date format" error:
- Use one of the supported date formats
- Ensure dates are not in the past (if validation is enabled)
- Check for extra spaces or special characters

### "Invalid time format" error:
- Use HH:MM format (24-hour) or HH:MM AM/PM (12-hour)
- Ensure times are within clinic operating hours
- Check for extra spaces

### "Appointment overlaps" error:
- Another appointment already exists for the same doctor at that time
- Change the time or doctor for the conflicting appointment

## Tips

1. **Start Small**: Test with 1-2 appointments first before importing large batches
2. **Check Names**: Double-check doctor and room names before importing
3. **Use Template**: Download the template from the import modal for the correct format
4. **Backup**: Always backup your data before bulk imports
5. **Review**: After import, review the appointments to ensure they're correct

## Example CSV Structure

```csv
Patient Name,Patient Phone,Patient Email,Patient Gender,Doctor Name,Room Name,Appointment Date,Start Time,End Time,Status,Follow Type,Notes
John Doe,9876543210,john.doe@example.com,Male,Dr. Smith,Room 1,2024-12-20,09:00,09:30,booked,first time,Initial consultation
```

## Support

If you encounter any issues:
1. Check the validation errors in the import modal
2. Review the import statistics for failed rows
3. Check the browser console for detailed error messages
4. Ensure you have the necessary permissions (create permission for appointments)

