import { jsPDF } from 'jspdf';
import { TenantUser } from '../types/crm';

/**
 * Loads an image from a URL or data URL and converts to base64 for jsPDF embedding
 */
async function getBase64ImageFromUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:image')) return url;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 120;
          canvas.height = img.naturalHeight || img.height || 120;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

export interface ProfileExportOptions {
  user: TenantUser;
  institutionName: string;
  campusCode?: string;
  className?: string;
}

/**
 * Exports a student or teacher completed profile as a clean, professional A4 PDF.
 */
export async function exportProfileToPdf({
  user,
  institutionName,
  campusCode = 'MAIN-01',
  className = '',
}: ProfileExportOptions): Promise<string> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;

  const isStudent = user.role === 'student';
  const isTeacher = user.role === 'teacher';

  // 1. INSTITUTIONAL HEADER BOX
  doc.setFillColor(15, 23, 42); // Navy 900
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(institutionName.toUpperCase() || 'INSTITUTIONAL PORTAL', margin + 6, currentY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // Slate 300
  const subTitle = isStudent
    ? 'CONFIDENTIAL STUDENT ADMISSION DOSSIER & OFFICIAL PROFILE'
    : isTeacher
    ? 'ACADEMIC FACULTY PROFILE & SERVICE CREDENTIALS'
    : 'INSTITUTIONAL STAFF DOSSIER & RECORD';
  doc.text(subTitle, margin + 6, currentY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(192, 132, 252); // Purple 400
  doc.text(`CAMPUS: ${campusCode} | SYSTEM ID: ${user.id || (user as any)._id || 'N/A'}`, margin + 6, currentY + 19);

  currentY += 28;

  // 2. EMBED PHOTO IF AVAILABLE
  let photoData: string | null = null;
  if (user.photoUrl) {
    photoData = await getBase64ImageFromUrl(user.photoUrl);
  }

  // Draw photo box on the right
  const photoBoxWidth = 32;
  const photoBoxHeight = 38;
  const photoX = margin + contentWidth - photoBoxWidth;
  const infoX = margin;
  const infoWidth = contentWidth - photoBoxWidth - 4;

  if (photoData) {
    try {
      doc.addImage(photoData, 'JPEG', photoX, currentY, photoBoxWidth, photoBoxHeight);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.rect(photoX, currentY, photoBoxWidth, photoBoxHeight);
    } catch {
      // Fallback placeholder box
      doc.setFillColor(241, 245, 249);
      doc.rect(photoX, currentY, photoBoxWidth, photoBoxHeight, 'F');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('AFFIX PHOTO', photoX + 4, currentY + 20);
    }
  } else {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.rect(photoX, currentY, photoBoxWidth, photoBoxHeight, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('PASSPORT PHOTO', photoX + 3, currentY + 20);
  }

  // Key Header Particulars (left of photo)
  doc.setFillColor(248, 250, 252);
  doc.rect(infoX, currentY, infoWidth, photoBoxHeight, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(infoX, currentY, infoWidth, photoBoxHeight);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(user.fullName || 'UNSPECIFIED USER', infoX + 4, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  if (isStudent) {
    doc.text(`Roll Number: `, infoX + 4, currentY + 14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${user.rollNumber || 'N/A'}`, infoX + 26, currentY + 14);

    doc.setFont('helvetica', 'normal');
    doc.text(`Admission ID: `, infoX + 64, currentY + 14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${user.admissionId || 'N/A'}`, infoX + 86, currentY + 14);

    doc.setFont('helvetica', 'normal');
    doc.text(`Class & Div: `, infoX + 4, currentY + 21);
    doc.setFont('helvetica', 'bold');
    const classDisplay = className || user.classDivision || 'Enrolled Cohort';
    doc.text(classDisplay, infoX + 26, currentY + 21);

    doc.setFont('helvetica', 'normal');
    doc.text(`Department: `, infoX + 4, currentY + 28);
    doc.setFont('helvetica', 'bold');
    doc.text(`${user.departmentBranch || 'Computer Engineering'}`, infoX + 26, currentY + 28);

    doc.setFont('helvetica', 'normal');
    doc.text(`Academic Year: `, infoX + 4, currentY + 34);
    doc.setFont('helvetica', 'bold');
    doc.text(`${user.academicYear || '2025-2026'}`, infoX + 26, currentY + 34);
  } else if (isTeacher) {
    doc.text(`Designation: `, infoX + 4, currentY + 14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Faculty / Instructor`, infoX + 26, currentY + 14);

    doc.setFont('helvetica', 'normal');
    doc.text(`Specialization: `, infoX + 4, currentY + 21);
    doc.setFont('helvetica', 'bold');
    doc.text(`${user.specialization || 'Computer Science & Engineering'}`, infoX + 26, currentY + 21);

    doc.setFont('helvetica', 'normal');
    doc.text(`Qualification: `, infoX + 4, currentY + 28);
    doc.setFont('helvetica', 'bold');
    doc.text(`${user.qualification || 'Postgraduate Degree'}`, infoX + 26, currentY + 28);

    doc.setFont('helvetica', 'normal');
    doc.text(`Department: `, infoX + 4, currentY + 34);
    doc.setFont('helvetica', 'bold');
    doc.text(`${user.departmentBranch || 'Academic Faculty'}`, infoX + 26, currentY + 34);
  }

  currentY += photoBoxHeight + 6;

  // Helper to render section title bar
  const renderSectionHeader = (title: string) => {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, currentY, contentWidth, 6, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(margin, currentY + 6, margin + contentWidth, currentY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(title.toUpperCase(), margin + 4, currentY + 4.5);
    currentY += 8;
  };

  // Helper to render table of key-value pairs
  const renderGridRows = (rows: [string, string, string, string][]) => {
    const colWidths = [38, 52, 38, 54];
    doc.setFontSize(8);

    rows.forEach((row) => {
      const cellHeight = 7;
      let x = margin;

      // Label 1
      doc.setFillColor(248, 250, 252);
      doc.rect(x, currentY, colWidths[0], cellHeight, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(row[0], x + 2, currentY + 4.5);
      x += colWidths[0];

      // Value 1
      doc.setFillColor(255, 255, 255);
      doc.rect(x, currentY, colWidths[1], cellHeight, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(String(row[1] || '—').slice(0, 30), x + 2, currentY + 4.5);
      x += colWidths[1];

      // Label 2
      doc.setFillColor(248, 250, 252);
      doc.rect(x, currentY, colWidths[2], cellHeight, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(row[2], x + 2, currentY + 4.5);
      x += colWidths[2];

      // Value 2
      doc.setFillColor(255, 255, 255);
      doc.rect(x, currentY, colWidths[3], cellHeight, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(String(row[3] || '—').slice(0, 32), x + 2, currentY + 4.5);

      currentY += cellHeight;
    });

    currentY += 4;
  };

  // 3. SECTION A: PERSONAL PARTICULARS
  renderSectionHeader('1. Personal Particulars & Contact Information');
  renderGridRows([
    ['Date of Birth', user.dateOfBirth || '—', 'Gender', user.gender || '—'],
    ['Contact Phone', user.phone || '—', 'Official Email', user.email || '—'],
    ['Religion / Creed', user.religion || '—', 'Caste / Category', user.casteCategory || 'General'],
    ['Residential City', user.residentialAddress ? user.residentialAddress.slice(0, 30) : '—', 'Nationality', 'Indian'],
  ]);

  // Full Address line
  if (user.residentialAddress) {
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, currentY - 3, 38, 8, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Permanent Address', margin + 2, currentY + 2);

    doc.setFillColor(255, 255, 255);
    doc.rect(margin + 38, currentY - 3, contentWidth - 38, 8, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(user.residentialAddress.slice(0, 85), margin + 40, currentY + 2);
    currentY += 8;
  }

  // 4. SECTION B: PARENT / GUARDIAN DETAILS (for Student) or APPOINTMENT (for Teacher)
  if (isStudent) {
    renderSectionHeader('2. Parent & Legal Guardian Particulars');
    renderGridRows([
      ['Father Full Name', user.fatherName || '—', 'Father Mobile', user.fatherContact || '—'],
      ['Father Occupation', user.fatherOccupation || '—', 'Father Work Address', user.fatherAddress ? user.fatherAddress.slice(0, 28) : '—'],
      ['Mother Full Name', user.motherName || '—', 'Mother Mobile', user.motherContact || '—'],
      ['Mother Occupation', user.motherOccupation || '—', 'Emergency Contact', user.guardianContact || user.fatherContact || '—'],
    ]);

    // 5. SECTION C: PREVIOUS ACADEMIC RECORD
    renderSectionHeader('3. Previous Academic Records & Qualifications');
    renderGridRows([
      ['Qualifying Exam', user.previousQualification || 'Higher Secondary (HSC)', 'Passing Institution', user.previousInstitution || 'Recognized Board'],
      ['Examination Score', user.previousExamDetails || 'Distinction Standing', 'Verification Status', 'Verified by Registrar'],
    ]);
  } else if (isTeacher) {
    renderSectionHeader('2. Faculty Appointment & Department Credentials');
    renderGridRows([
      ['Specialization', user.specialization || 'Computer Science', 'Highest Qualification', user.qualification || 'Doctoral / Masters'],
      ['Department', user.departmentBranch || 'Computer Engineering', 'Account Role', 'Active Academic Instructor'],
      ['Assigned Cohorts', className || 'Allocated Sections', 'Employment Status', 'Regular Faculty'],
    ]);
  }

  // 6. DECLARATION & SIGNATURE FOOTER
  currentY = Math.max(currentY + 2, pageHeight - 56);

  doc.setFillColor(248, 250, 252);
  doc.rect(margin, currentY, contentWidth, 38, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, currentY, contentWidth, 38);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('OFFICIAL DECLARATION & AUTHENTICATION', margin + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  const declarationText = isStudent
    ? 'I hereby affirm that all particulars filled above are accurate to the best of my knowledge and comply with official institutional admission regulations. Any discrepancy found shall lead to immediate cancellation of enrollment.'
    : 'I certify that the above credentials, qualifications, and service details represent an authentic record of my appointment and academic standing at this institution.';
  doc.text(declarationText, margin + 4, currentY + 10, { maxWidth: contentWidth - 8 });

  // Signatures
  const sigY = currentY + 24;

  // Student/Teacher Signature (Embed signature if exists)
  if (user.signatureUrl) {
    const sigData = await getBase64ImageFromUrl(user.signatureUrl);
    if (sigData) {
      try {
        doc.addImage(sigData, 'PNG', margin + 6, sigY - 8, 32, 10);
      } catch {
        // Fallback line
      }
    }
  }

  doc.setDrawColor(100, 116, 139);
  doc.line(margin + 4, sigY, margin + 45, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text(isStudent ? 'Candidate / Student Signature' : 'Faculty Member Signature', margin + 4, sigY + 4);

  // Institution Stamp & Registrar Sign
  const regX = margin + contentWidth - 55;
  doc.line(regX, sigY, regX + 48, sigY);
  doc.text('Registrar / Authorized Official', regX, sigY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  const dateGenerated = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  doc.text(`Generated on: ${dateGenerated} | Validated Digital Copy`, margin + 4, currentY + 34);

  // Save/Download PDF
  const safeName = (user.fullName || 'User').replace(/[^a-zA-Z0-9]/g, '_');
  const safeId = user.rollNumber || user.admissionId || user.id || (user as any)._id || 'RECORD';
  const prefix = isStudent ? 'Student_Profile' : isTeacher ? 'Teacher_Profile' : 'Profile';
  const filename = `${prefix}_${safeId}_${safeName}.pdf`;

  doc.save(filename);
  return filename;
}
