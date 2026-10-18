import React, { useState, useMemo } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Download,
  Users,
  Check,
  X,
  RefreshCw,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { SchoolClass, TenantUser } from '../types/crm';

interface ParsedStudentRow {
  rowNum: number;
  rollNumber: string;
  fullName: string;
  email?: string;
  phone?: string;
  status: 'valid' | 'warning' | 'error';
  validationMessage?: string;
}

export const StudentRosterImport: React.FC = () => {
  const { currentUser, classes, users, importClassRoster } = useApp();
  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'admin';
  const isTeacher = currentUser.role === 'teacher';

  // Authorized classes
  const authorizedClasses = useMemo(() => {
    if (isAdmin) return classes;
    if (isTeacher) {
      const filtered = classes.filter((c: SchoolClass) => {
        const cId = c.id || (c as any)._id;
        const isPrimary = c.primaryTeacherId === currentUser.id;
        const isAssigned = currentUser.assignedClassIds?.includes(cId);
        return isPrimary || isAssigned;
      });
      return filtered.length > 0 ? filtered : classes;
    }
    return classes;
  }, [classes, currentUser, isAdmin, isTeacher]);

  const [selectedClassId, setSelectedClassId] = useState<string>(
    authorizedClasses[0]?.id || (authorizedClasses[0] as any)?._id || ''
  );

  const selectedClass = authorizedClasses.find(
    (c) => (c.id || (c as any)._id) === selectedClassId
  );

  // File upload & parsing states
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'valid' | 'errors'>('all');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    importedCount?: number;
    createdCount?: number;
    updatedCount?: number;
  } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Existing student roll numbers in this institution database
  const existingRollNumbers = useMemo(() => {
    return new Set(users.filter((u) => u.role === 'student' && u.rollNumber).map((u) => String(u.rollNumber).trim()));
  }, [users]);

  // Handle template download
  const handleDownloadTemplate = () => {
    const templateData = [
      { 'Roll Number': 'CS-101', 'Student Name': 'Aarav Sharma', 'Email': 'aarav@school.edu', 'Phone': '+91 9876543210' },
      { 'Roll Number': 'CS-102', 'Student Name': 'Ananya Patel', 'Email': 'ananya@school.edu', 'Phone': '+91 9876543211' },
      { 'Roll Number': 'CS-103', 'Student Name': 'Rohan Gupta', 'Email': 'rohan@school.edu', 'Phone': '+91 9876543212' },
      { 'Roll Number': 'CS-104', 'Student Name': 'Diya Verma', 'Email': 'diya@school.edu', 'Phone': '+91 9876543213' },
      { 'Roll Number': 'CS-105', 'Student Name': 'Ishaan Sen', 'Email': 'ishaan@school.edu', 'Phone': '+91 9876543214' },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Roster');
    XLSX.writeFile(workbook, 'Student_Roster_Template.xlsx');
  };

  // Parse uploaded CSV / Excel file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    setImportResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const data = new Uint8Array(buffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          setFileError('The uploaded file contains no readable worksheets.');
          return;
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rawJson || rawJson.length < 2) {
          setFileError('File appears empty or does not contain a header row with data.');
          return;
        }

        // Header detection
        let headerRowIdx = -1;
        let rollIdx = -1;
        let nameIdx = -1;
        let emailIdx = -1;
        let phoneIdx = -1;

        for (let r = 0; r < Math.min(rawJson.length, 10); r++) {
          const row = rawJson[r];
          if (!Array.isArray(row)) continue;
          const headers = row.map((h: any) => String(h || '').trim().toLowerCase());
          
          const rIdx = headers.findIndex((h) => h.includes('roll') || h.includes('id') || h === 'roll_no' || h === 'roll number');
          const nIdx = headers.findIndex((h) => h.includes('name') || h.includes('student') || h === 'full name');
          
          if (rIdx !== -1 && nIdx !== -1) {
            headerRowIdx = r;
            rollIdx = rIdx;
            nameIdx = nIdx;
            emailIdx = headers.findIndex((h) => h.includes('email') || h.includes('mail'));
            phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('contact'));
            break;
          }
        }

        if (headerRowIdx === -1) {
          const headers: string[] = rawJson[0].map((h: any) => String(h).trim().toLowerCase());
          rollIdx = headers.findIndex((h) => h.includes('roll') || h.includes('id') || h.includes('number'));
          nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('student'));
          emailIdx = headers.findIndex((h) => h.includes('email') || h.includes('mail'));
          phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('contact') || h.includes('mobile'));
          if (rollIdx === -1 && headers.length > 0) rollIdx = 0;
          if (nameIdx === -1 && headers.length > 1) nameIdx = 1;
          headerRowIdx = 0;
        }

        if (rollIdx === -1 || nameIdx === -1) {
          setFileError('Could not identify required columns: "Roll Number" and "Student Name". Please use the template.');
          return;
        }

        // Process rows
        const parsed: ParsedStudentRow[] = [];
        const seenRollsInFile = new Set<string>();

        for (let i = headerRowIdx + 1; i < rawJson.length; i++) {
          const rowData = rawJson[i];
          if (!rowData || rowData.length === 0 || rowData.every((cell: any) => cell === '')) {
            continue; // skip completely blank rows
          }

          const rollVal = String(rowData[rollIdx] || '').trim();
          const nameVal = String(rowData[nameIdx] || '').trim();
          const emailVal = emailIdx !== -1 ? String(rowData[emailIdx] || '').trim() : undefined;
          const phoneVal = phoneIdx !== -1 ? String(rowData[phoneIdx] || '').trim() : undefined;

          let status: 'valid' | 'warning' | 'error' = 'valid';
          let validationMessage: string | undefined;

          if (!rollVal && !nameVal) {
            continue; // skip blank
          }

          if (!rollVal) {
            status = 'error';
            validationMessage = 'Missing required Roll Number.';
          } else if (!nameVal) {
            status = 'error';
            validationMessage = 'Missing required Student Name.';
          } else if (seenRollsInFile.has(rollVal.toLowerCase())) {
            status = 'error';
            validationMessage = `Duplicate Roll Number "${rollVal}" found inside this file.`;
          } else if (existingRollNumbers.has(rollVal)) {
            status = 'warning';
            validationMessage = `Student "${rollVal}" already exists in institution database; will be reassigned/updated.`;
            seenRollsInFile.add(rollVal.toLowerCase());
          } else {
            status = 'valid';
            validationMessage = 'Valid student record ready to import.';
            seenRollsInFile.add(rollVal.toLowerCase());
          }

          parsed.push({
            rowNum: i + 1,
            rollNumber: rollVal,
            fullName: nameVal,
            email: emailVal,
            phone: phoneVal,
            status,
            validationMessage,
          });
        }

        if (parsed.length === 0) {
          setFileError('No student data rows could be extracted from this file.');
          return;
        }

        setParsedRows(parsed);
      } catch (err: any) {
        setFileError(`Failed to process file: ${err.message || 'Corrupted or unsupported format.'}`);
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Filter parsed rows
  const displayRows = useMemo(() => {
    if (filterMode === 'valid') return parsedRows.filter((r) => r.status === 'valid' || r.status === 'warning');
    if (filterMode === 'errors') return parsedRows.filter((r) => r.status === 'error');
    return parsedRows;
  }, [parsedRows, filterMode]);

  const validCount = parsedRows.filter((r) => r.status !== 'error').length;
  const errorCount = parsedRows.filter((r) => r.status === 'error').length;

  // Confirm and Execute Import
  const handleConfirmImport = async () => {
    if (!selectedClassId) {
      setFileError('Please select a target cohort class before importing.');
      return;
    }

    const validStudentsToImport = parsedRows
      .filter((r) => r.status !== 'error')
      .map((r) => ({
        rollNumber: r.rollNumber,
        fullName: r.fullName,
        email: r.email,
        phone: r.phone,
      }));

    if (validStudentsToImport.length === 0) {
      setFileError('No valid student records available to import.');
      return;
    }

    setIsImporting(true);
    setFileError(null);

    const res = await importClassRoster(selectedClassId, validStudentsToImport);
    setIsImporting(false);

    if (res.ok) {
      setImportResult({
        success: true,
        message: res.message || `Successfully imported ${validStudentsToImport.length} students.`,
        importedCount: res.importedCount,
        createdCount: res.createdCount,
        updatedCount: res.updatedCount,
      });
      // Clear uploaded file so user can upload another or inspect class
      setParsedRows([]);
      setFileName(null);
    } else {
      setFileError(res.message || 'Failed to complete roster import.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {importResult && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold">{importResult.message}</p>
              <p className="text-[11px] text-emerald-400/80 mt-0.5">
                New accounts created: {importResult.createdCount || 0} &middot; Existing students linked: {importResult.updatedCount || 0}
              </p>
            </div>
          </div>
          <button onClick={() => setImportResult(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {fileError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{fileError}</span>
          </div>
          <button onClick={() => setFileError(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Student Roster Batch Import</h1>
          <p className="text-xs text-slate-400 mt-1">
            Upload institutional student rosters via CSV or Excel (.xlsx) files with instant schema validation and class enrollment.
          </p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="px-4 py-2 text-xs font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Download Sample CSV / Excel</span>
        </button>
      </div>

      {/* Target Class Selection & File Upload Card */}
      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Class Target */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              Target Cohort / Assigned Class *
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
            >
              {authorizedClasses.map((c) => {
                const cId = c.id || (c as any)._id;
                return (
                  <option key={cId} value={cId} className="bg-slate-900 text-white">
                    {c.name} ({c.gradeLevel} - {c.section || 'General'}) &middot; {c.studentIds?.length || 0} currently enrolled
                  </option>
                );
              })}
            </select>

            {selectedClass && (
              <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-xs text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Class Room:</span>
                  <span className="font-mono">{selectedClass.roomNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Class Capacity:</span>
                  <span className="font-mono">{selectedClass.capacity} Seats</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Enrollment:</span>
                  <span className="font-mono text-purple-300 font-bold">{selectedClass.studentIds?.length || 0} Students</span>
                </div>
              </div>
            )}
          </div>

          {/* Drag & Drop Upload Zone */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              Select Roster File (.csv, .xlsx, .xls)
            </label>
            <label className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-white/15 hover:border-purple-500/60 bg-black/30 hover:bg-white/[0.02] cursor-pointer transition-all group">
              <Upload className="w-8 h-8 text-slate-400 group-hover:text-purple-400 mb-2 transition-colors" />
              <span className="text-xs font-semibold text-white">
                {fileName ? fileName : 'Click to choose or drag & drop roster spreadsheet'}
              </span>
              <span className="text-[11px] text-slate-400 mt-1">
                Accepts Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv)
              </span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Roster Preview Section (when rows exist) */}
      {parsedRows.length > 0 && (
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-5 animate-in fade-in">
          {/* Summary Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-purple-400" />
                <span>Roster Preview &amp; Validation ({parsedRows.length} total rows)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Review verified student records before committing to the institutional database.
              </p>
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400'
                }`}
              >
                All ({parsedRows.length})
              </button>
              <button
                onClick={() => setFilterMode('valid')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  filterMode === 'valid'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white/5 hover:bg-white/10 text-emerald-400'
                }`}
              >
                Valid ({validCount})
              </button>
              {errorCount > 0 && (
                <button
                  onClick={() => setFilterMode('errors')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    filterMode === 'errors'
                      ? 'bg-red-600 text-white'
                      : 'bg-white/5 hover:bg-white/10 text-red-400'
                  }`}
                >
                  Errors ({errorCount})
                </button>
              )}
            </div>
          </div>

          {/* Validation Report Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
              <span className="text-xs text-slate-400">Total Rows Detected</span>
              <span className="text-sm font-bold font-mono text-white">{parsedRows.length}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <span className="text-xs text-emerald-300">Ready to Import</span>
              <span className="text-sm font-bold font-mono text-emerald-400">{validCount} Students</span>
            </div>
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between">
              <span className="text-xs text-red-300">Invalid Records</span>
              <span className="text-sm font-bold font-mono text-red-400">{errorCount}</span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 bg-white/[0.02]">
                  <th className="py-3 px-4 w-12 text-center">Row</th>
                  <th className="py-3 px-4 w-32">Roll Number</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4 w-28 text-center">Status</th>
                  <th className="py-3 px-4">Validation Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {displayRows.map((r) => (
                  <tr
                    key={r.rowNum}
                    className={`hover:bg-white/[0.02] transition-colors ${
                      r.status === 'error' ? 'bg-red-500/10' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 text-center font-mono text-slate-500">{r.rowNum}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-white">{r.rollNumber || '-'}</td>
                    <td className="py-2.5 px-4 text-white font-medium">{r.fullName || '-'}</td>
                    <td className="py-2.5 px-4 text-slate-400 font-mono">{r.email || '-'}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                          r.status === 'valid'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : r.status === 'warning'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}
                      >
                        {r.status === 'valid' && <Check className="w-3 h-3" />}
                        {r.status === 'warning' && <AlertTriangle className="w-3 h-3" />}
                        {r.status === 'error' && <X className="w-3 h-3" />}
                        <span className="capitalize">{r.status}</span>
                      </span>
                    </td>
                    <td
                      className={`py-2.5 px-4 text-[11px] ${
                        r.status === 'error'
                          ? 'text-red-300 font-medium'
                          : r.status === 'warning'
                          ? 'text-amber-300'
                          : 'text-slate-400'
                      }`}
                    >
                      {r.validationMessage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Confirmation Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
            <div className="text-xs text-slate-400">
              Target Cohort:{' '}
              <span className="text-white font-semibold">
                {selectedClass?.name} ({selectedClass?.gradeLevel})
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setParsedRows([]);
                  setFileName(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-white/5 cursor-pointer"
              >
                Discard &amp; Reset
              </button>
              <button
                type="button"
                disabled={isImporting || validCount === 0}
                onClick={handleConfirmImport}
                className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-40"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importing Roster to Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm &amp; Import {validCount} Students</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
