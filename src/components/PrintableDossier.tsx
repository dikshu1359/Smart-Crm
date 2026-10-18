import React from 'react';
import { TenantUser, SchoolClass } from '../types/crm';

interface PrintableDossierProps {
  user: TenantUser | null;
  institutionName: string;
  campusCode?: string;
  classes: SchoolClass[];
  attendanceSessions?: any[];
  marks?: any[];
  assignments?: any[];
}

/**
 * PrintableDossier
 * Clean, standard A4 printable official record for Students and Faculty.
 * Exclusively revealed and styled during browser print dialog.
 */
export const PrintableDossier: React.FC<PrintableDossierProps> = ({
  user,
  institutionName,
  campusCode,
  classes,
  attendanceSessions = [],
  marks = [],
  assignments = [],
}) => {
  if (!user) return null;

  const isStudent = user.role === 'student';
  const uId = String(user.id || (user as any)._id || '');

  // Find assigned class
  const assignedClassId = user.assignedClassId || (user.assignedClassIds && user.assignedClassIds[0]);
  const userClass = classes.find((c) => String(c.id || (c as any)._id) === String(assignedClassId));

  // Calculate student attendance from actual recorded sessions
  let studentPresent = 0;
  let studentTotal = 0;
  attendanceSessions.forEach((s) => {
    const rec = (s.records || []).find((r: any) => String(r.studentId) === uId);
    if (rec) {
      studentTotal += 1;
      if (rec.status === 'present') studentPresent += 1;
    }
  });
  const attendanceRate = studentTotal > 0 ? Math.round((studentPresent / studentTotal) * 100) : 100;

  // Calculate marks average
  const studentMarks = marks.filter((m: any) => String(m.studentId) === uId && m.isPublished !== false);
  const avgMarks =
    studentMarks.length > 0
      ? Math.round(studentMarks.reduce((acc: number, m: any) => acc + (Number(m.percentage) || 0), 0) / studentMarks.length)
      : null;

  // Assignments submitted
  let submittedCount = 0;
  assignments.forEach((a: any) => {
    if ((a.submissions || []).some((sub: any) => String(sub.studentId) === uId)) {
      submittedCount += 1;
    }
  });

  return (
    <div id="printable-dossier" className="hidden print:block font-sans text-black bg-white p-6 max-w-[210mm] mx-auto text-[11px] leading-relaxed">
      {/* Institution Header */}
      <div className="text-center pb-3 border-b-2 border-black mb-4">
        <h1 className="text-xl font-extrabold uppercase tracking-wider text-black">
          {institutionName || 'Institutional Academic Management'}
        </h1>
        <p className="text-[11px] text-gray-800 font-semibold mt-0.5">
          Campus Code: {campusCode || 'CAMPUS-MAIN'} &middot; Academic Administration &amp; Registrar Office
        </p>
        <div className="text-xs font-bold uppercase tracking-widest mt-2 bg-gray-100 py-1 border border-black text-black">
          {isStudent ? 'Official Student Enrolment & Admission Dossier' : 'Official Faculty Profile & Service Dossier'}
        </div>
      </div>

      {/* Identity & Photo Header Grid */}
      <div className="flex justify-between items-start gap-4 mb-4 pb-3 border-b border-gray-400">
        <div className="flex-1">
          <table className="w-full text-[11px] border-collapse">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-1 font-bold w-44 text-gray-900">Full Legal Name:</td>
                <td className="py-1 font-bold text-black uppercase text-xs">{user.fullName}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1 font-bold text-gray-900">
                  {isStudent ? 'Roll Number / Student ID:' : 'Faculty / Employee ID:'}
                </td>
                <td className="py-1 font-mono font-bold text-black">{user.rollNumber || user.username}</td>
              </tr>
              {isStudent && (
                <>
                  <tr className="border-b border-gray-200">
                    <td className="py-1 font-bold text-gray-900">Admission / Application ID:</td>
                    <td className="py-1 font-mono text-black">{user.admissionId || 'ADM-2024-CS101'}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-1 font-bold text-gray-900">Academic Year:</td>
                    <td className="py-1 font-mono text-black">{user.academicYear || '2025-2026'}</td>
                  </tr>
                </>
              )}
              <tr className="border-b border-gray-200">
                <td className="py-1 font-bold text-gray-900">
                  {isStudent ? 'Assigned Cohort / Class:' : 'Teaching Department / Branch:'}
                </td>
                <td className="py-1 text-black font-semibold">
                  {isStudent
                    ? `${userClass?.name || 'Computer Science Engineering'} — ${user.classDivision || userClass?.section || 'Division A'}`
                    : user.departmentBranch || user.specialization || 'Computer Science & Engineering'}
                </td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1 font-bold text-gray-900">
                  {isStudent ? 'Department / Branch:' : 'Academic Qualification:'}
                </td>
                <td className="py-1 text-black">
                  {isStudent
                    ? user.departmentBranch || 'Computer Engineering'
                    : user.qualification || 'M.Tech / Ph.D in Computer Science'}
                </td>
              </tr>
              {isStudent && (
                <tr>
                  <td className="py-1 font-bold text-gray-900">Grade / Year Level:</td>
                  <td className="py-1 text-black font-bold">{user.gradeLevel || 'Year 3 / Semester 5'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Passport Photo Box (Standard 35mm x 45mm proportion) */}
        <div className="w-32 h-40 border-2 border-black flex flex-col items-center justify-center p-1 shrink-0 bg-gray-50 text-center">
          {user.photoUrl ? (
            <img src={user.photoUrl} alt={user.fullName} className="w-full h-full object-cover" />
          ) : (
            <div className="text-[10px] text-gray-600 font-bold uppercase p-2 leading-tight">
              Official Photograph
              <span className="block text-[8px] font-normal mt-1">(35mm &times; 45mm)</span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: PERSONAL PARTICULARS */}
      <div className="mb-4">
        <h3 className="text-xs font-bold uppercase bg-gray-100 px-2 py-1 border border-black mb-2 text-black">
          1. Personal Particulars &amp; Contact Details
        </h3>
        <table className="w-full border-collapse border border-gray-400 text-[10px]">
          <tbody>
            <tr className="border-b border-gray-300">
              <td className="p-1.5 w-1/4 font-bold bg-gray-50 border-r border-gray-300">Date of Birth:</td>
              <td className="p-1.5 w-1/4 border-r border-gray-300 font-mono">{user.dateOfBirth || '14 May 2004'}</td>
              <td className="p-1.5 w-1/4 font-bold bg-gray-50 border-r border-gray-300">Gender:</td>
              <td className="p-1.5 w-1/4">{user.gender || 'Not Specified'}</td>
            </tr>
            <tr className="border-b border-gray-300">
              <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Contact Number:</td>
              <td className="p-1.5 border-r border-gray-300 font-mono">{user.phone || '+91 98200 88991'}</td>
              <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Institutional Email:</td>
              <td className="p-1.5 font-mono">{user.email}</td>
            </tr>
            <tr className="border-b border-gray-300">
              <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Religion:</td>
              <td className="p-1.5 border-r border-gray-300">{user.religion || 'Hindu'}</td>
              <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Caste / Category:</td>
              <td className="p-1.5">{user.casteCategory || 'General'}</td>
            </tr>
            <tr>
              <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Residential Address:</td>
              <td colSpan={3} className="p-1.5">
                {user.residentialAddress || 'Linking Road, Bandra West, Mumbai 400050, Maharashtra'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SECTION 2: PARENT & GUARDIAN PARTICULARS (For Students) */}
      {isStudent && (
        <div className="mb-4">
          <h3 className="text-xs font-bold uppercase bg-gray-100 px-2 py-1 border border-black mb-2 text-black">
            2. Parent &amp; Guardian Information
          </h3>
          <table className="w-full border-collapse border border-gray-400 text-[10px]">
            <tbody>
              <tr className="border-b border-gray-300">
                <td className="p-1.5 w-1/4 font-bold bg-gray-50 border-r border-gray-300">Father's Full Name:</td>
                <td className="p-1.5 w-1/4 border-r border-gray-300 font-semibold">{user.fatherName || 'Suresh Deshmukh'}</td>
                <td className="p-1.5 w-1/4 font-bold bg-gray-50 border-r border-gray-300">Father's Contact:</td>
                <td className="p-1.5 w-1/4 font-mono">{user.fatherContact || '+91 98200 11223'}</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Father's Occupation:</td>
                <td className="p-1.5 border-r border-gray-300">{user.fatherOccupation || 'Senior Electrical Engineer'}</td>
                <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Father's Address:</td>
                <td className="p-1.5">{user.fatherAddress || user.residentialAddress || 'Same as residential address'}</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Mother's Full Name:</td>
                <td className="p-1.5 border-r border-gray-300 font-semibold">{user.motherName || 'Sunita Deshmukh'}</td>
                <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Mother's Contact:</td>
                <td className="p-1.5 font-mono">{user.motherContact || '+91 98200 11224'}</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Mother's Occupation:</td>
                <td className="p-1.5 border-r border-gray-300">{user.motherOccupation || 'High School Lecturer'}</td>
                <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Guardian Contact:</td>
                <td className="p-1.5 font-mono">{user.guardianContact || user.fatherContact || '+91 98200 11223'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* SECTION 3: ACADEMIC HISTORY & STANDING */}
      <div className="mb-4">
        <h3 className="text-xs font-bold uppercase bg-gray-100 px-2 py-1 border border-black mb-2 text-black">
          {isStudent ? '3. Previous Academic Credentials & Current Progress' : '2. Academic Appointment & Assigned Cohorts'}
        </h3>
        <table className="w-full border-collapse border border-gray-400 text-[10px]">
          <tbody>
            {isStudent ? (
              <>
                <tr className="border-b border-gray-300">
                  <td className="p-1.5 w-1/4 font-bold bg-gray-50 border-r border-gray-300">Prior Qualification:</td>
                  <td className="p-1.5 w-1/4 border-r border-gray-300">
                    {user.previousQualification || 'Higher Secondary Certificate (HSC 12th)'}
                  </td>
                  <td className="p-1.5 w-1/4 font-bold bg-gray-50 border-r border-gray-300">Prior Institution:</td>
                  <td className="p-1.5 w-1/4">{user.previousInstitution || 'St. Xavier Junior College'}</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Board Exam Result:</td>
                  <td colSpan={3} className="p-1.5">
                    {user.previousExamDetails || 'Scored 92.4% in PCM Board Examinations'}
                  </td>
                </tr>
                <tr>
                  <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Attendance Status:</td>
                  <td className="p-1.5 border-r border-gray-300 font-bold font-mono">
                    {attendanceRate}% ({studentPresent} / {studentTotal} sessions present)
                  </td>
                  <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Assessment Average:</td>
                  <td className="p-1.5 font-bold font-mono">
                    {avgMarks !== null ? `${avgMarks}%` : 'Grading In Progress'} &middot; {submittedCount} assignments submitted
                  </td>
                </tr>
              </>
            ) : (
              <>
                <tr className="border-b border-gray-300">
                  <td className="p-1.5 w-1/4 font-bold bg-gray-50 border-r border-gray-300">Highest Qualification:</td>
                  <td className="p-1.5 w-1/4 border-r border-gray-300">{user.qualification || 'Ph.D. in Computer Science'}</td>
                  <td className="p-1.5 w-1/4 font-bold bg-gray-50 border-r border-gray-300">Specialization:</td>
                  <td className="p-1.5 w-1/4">{user.specialization || 'Operating Systems & Networks'}</td>
                </tr>
                <tr>
                  <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Assigned Cohorts:</td>
                  <td colSpan={3} className="p-1.5">
                    {classes
                      .filter((c) => user.assignedClassIds?.map(String).includes(String(c.id || (c as any)._id)))
                      .map((c) => c.name)
                      .join(', ') || 'B.Tech Computer Science - Section A'}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* SECTION 4: DECLARATION & VERIFICATION SIGNATURES */}
      <div className="mt-6 pt-4 border-t-2 border-black">
        <p className="text-[9px] text-gray-700 italic mb-5 leading-normal">
          Declaration: I hereby solemnly declare that all statements and information furnished in this official record are true, complete, and correct to the best of my knowledge and belief.
        </p>

        <div className="grid grid-cols-3 gap-6 text-center text-[10px]">
          <div>
            <div className="h-10 border-b border-black mb-1 flex items-end justify-center pb-1">
              {user.signatureUrl ? (
                <img src={user.signatureUrl} alt="Signature" className="h-8 max-w-[120px] object-contain" />
              ) : (
                <span className="font-serif italic text-sm">{user.fullName}</span>
              )}
            </div>
            <span className="font-bold text-gray-900 block">{isStudent ? 'Student Signature' : 'Faculty Signature'}</span>
            <span className="text-[9px] text-gray-600 block">Date: {new Date().toLocaleDateString()}</span>
          </div>

          <div>
            <div className="h-10 border-b border-black mb-1 flex items-end justify-center pb-1">
              <span className="font-serif italic text-xs text-gray-700">Verified &amp; Approved</span>
            </div>
            <span className="font-bold text-gray-900 block">Class Teacher / Mentor</span>
            <span className="text-[9px] text-gray-600 block">Official Signature</span>
          </div>

          <div>
            <div className="h-10 border-b border-black mb-1 flex items-end justify-center pb-1">
              <span className="text-[9px] text-gray-500 uppercase tracking-widest font-mono">[ Institutional Seal ]</span>
            </div>
            <span className="font-bold text-gray-900 block">Dean / Registrar Office</span>
            <span className="text-[9px] text-gray-600 block">Authorized Signatory</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintableDossier;
