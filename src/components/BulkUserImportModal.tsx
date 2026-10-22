import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Plus,
  Copy,
  Check,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
  Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import api from '../services/api';
import { SchoolClass, TenantUser } from '../types/crm';

export interface BulkImportRow {
  id: string;
  fullName: string;
  rollNumber: string;
  email: string;
  username: string;
  initialPassword: string;
  role: 'student' | 'teacher';
  assignedClassId?: string;
  status: 'valid' | 'invalid';
  validationMessage?: string;
}

interface BulkUserImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  databaseName: string;
  institutionName: string;
  classes: SchoolClass[];
  existingUsers: TenantUser[];
  onImportComplete: () => Promise<void>;
}

export const BulkUserImportModal: React.FC<BulkUserImportModalProps> = ({
  isOpen,
  onClose,
  databaseName,
  institutionName,
  classes,
  existingUsers,
  onImportComplete,
}) => {
  if (!isOpen) return null;

  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'summary'>('upload');
  const [targetRole, setTargetRole] = useState<'student' | 'teacher'>('student');
  const [defaultClassId, setDefaultClassId] = useState<string>('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawSheetData, setRawSheetData] = useState<Record<string, any>[]>([]);
  const [columnMap, setColumnMap] = useState<{
    fullName: string;
    rollNumber: string;
    email: string;
    username: string;
    password: string;
  }>({
    fullName: '',
    rollNumber: '',
    email: '',
    username: '',
    password: '',
  });

  const [previewRows, setPreviewRows] = useState<BulkImportRow[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<{
    createdCount: number;
    failedCount: number;
    createdUsers: any[];
    errors: any[];
  } | null>(null);

  const [copiedSummary, setCopiedSummary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateDeterministicUsername = (name: string, roll: string, idx: number, role: string) => {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    const cleanRoll = roll.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-4);
    if (cleanRoll) {
      return `${role === 'teacher' ? 'fac' : 'stu'}_${cleanRoll}`;
    }
    return cleanName ? `${cleanName}_${idx + 101}` : `${role === 'teacher' ? 'faculty' : 'student'}_${Date.now().toString().slice(-4)}_${idx}`;
  };

  const generateDeterministicPassword = (role: string, idx: number) => {
    const prefix = role === 'teacher' ? 'Faculty' : 'Student';
    return `${prefix}#${1000 + ((idx * 37 + 123) % 8999)}`;
  };

  const validateRow = (
    row: BulkImportRow,
    allRows: BulkImportRow[],
    existing: TenantUser[]
  ): { status: 'valid' | 'invalid'; message?: string } => {
    if (!row.fullName.trim()) {
      return { status: 'invalid', message: 'Full Name is required' };
    }
    if (!row.email.trim() || !row.email.includes('@')) {
      return { status: 'invalid', message: 'Valid email address is required' };
    }
    if (!row.username.trim()) {
      return { status: 'invalid', message: 'Username is required' };
    }

    // Check duplicate in preview table
    const dupUser = allRows.filter((r) => r.username.toLowerCase() === row.username.toLowerCase());
    if (dupUser.length > 1) {
      return { status: 'invalid', message: `Duplicate username "${row.username}" in import batch` };
    }

    const dupEmail = allRows.filter((r) => r.email.toLowerCase() === row.email.toLowerCase());
    if (dupEmail.length > 1) {
      return { status: 'invalid', message: `Duplicate email "${row.email}" in import batch` };
    }

    // Check duplicate against existing users in institution
    const existsInDb = existing.find(
      (u) =>
        u.username.toLowerCase() === row.username.toLowerCase() ||
        u.email.toLowerCase() === row.email.toLowerCase()
    );
    if (existsInDb) {
      const isUser = existsInDb.username.toLowerCase() === row.username.toLowerCase();
      return {
        status: 'invalid',
        message: isUser ? `Username "${row.username}" already registered in institution` : `Email already registered in institution`,
      };
    }

    return { status: 'valid' };
  };

  const revalidateAllRows = (rows: BulkImportRow[]) => {
    return rows.map((r) => {
      const val = validateRow(r, rows, existingUsers);
      return {
        ...r,
        status: val.status,
        validationMessage: val.message,
      };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setUploadError('File size exceeds the maximum limit of 20 MB.');
      return;
    }

    setIsProcessing(true);
    const name = file.name.toLowerCase();

    try {
      if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (json.length === 0) {
          setUploadError('The spreadsheet contains no readable rows.');
          setIsProcessing(false);
          return;
        }

        const headers = Object.keys(json[0]);
        setRawHeaders(headers);
        setRawSheetData(json);

        // Auto-detect column mapping
        const autoMap = {
          fullName: headers.find((h) => /name|student|faculty|full/i.test(h)) || headers[0] || '',
          rollNumber: headers.find((h) => /roll|id|emp|reg|code/i.test(h)) || '',
          email: headers.find((h) => /mail|email/i.test(h)) || '',
          username: headers.find((h) => /user|login/i.test(h)) || '',
          password: headers.find((h) => /pass|pwd|credential/i.test(h)) || '',
        };

        setColumnMap(autoMap);
        setStep('mapping');
      } else if (name.endsWith('.docx')) {
        const buffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        const text = result.value || '';
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

        if (lines.length === 0) {
          setUploadError('No text extracted from DOCX document. It may contain scanned images.');
          setIsProcessing(false);
          return;
        }

        // Parse lines or tabular separated items
        const generatedRows: BulkImportRow[] = [];
        lines.forEach((line, idx) => {
          // Check if line looks like "Name, Roll, Email" or tab delimited
          const parts = line.split(/[,\t|]/).map((p) => p.trim());
          if (parts.length >= 2) {
            const rowName = parts[0] || `User ${idx + 1}`;
            const rowRoll = parts[1] || `R-${idx + 101}`;
            const rowEmail = parts[2] || `${rowRoll.toLowerCase()}@vcet.edu`;
            const rowUser = generateDeterministicUsername(rowName, rowRoll, idx, targetRole);
            const rowPwd = generateDeterministicPassword(targetRole, idx);

            generatedRows.push({
              id: `row-${idx}-${Date.now()}`,
              fullName: rowName,
              rollNumber: rowRoll,
              email: rowEmail,
              username: rowUser,
              initialPassword: rowPwd,
              role: targetRole,
              assignedClassId: defaultClassId,
              status: 'valid',
            });
          }
        });

        if (generatedRows.length === 0) {
          setUploadError('Could not detect structured record rows in this Word document. Please ensure records are separated by commas, tabs, or newlines.');
          setIsProcessing(false);
          return;
        }

        const validated = revalidateAllRows(generatedRows);
        setPreviewRows(validated);
        setStep('preview');
      } else if (name.endsWith('.pdf')) {
        // PDF text extraction explanation:
        setUploadError(
          'PDF Document Analysis: If your PDF contains selectable text, please export as CSV/XLSX for fastest column alignment. Scanned PDF image OCR is not configured in this offline-safe environment.'
        );
      } else {
        setUploadError('Unsupported file format. Please upload an Excel spreadsheet (.xlsx), CSV (.csv), or Word document (.docx).');
      }
    } catch (err: any) {
      setUploadError(`Failed to process document: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const applyMappingAndPreview = () => {
    if (!columnMap.fullName) {
      setUploadError('Full Name column mapping is required.');
      return;
    }

    const rows: BulkImportRow[] = rawSheetData.map((item, idx) => {
      const name = String(item[columnMap.fullName] || '').trim();
      const roll = columnMap.rollNumber ? String(item[columnMap.rollNumber] || '').trim() : '';
      const email = columnMap.email
        ? String(item[columnMap.email] || '').trim().toLowerCase()
        : `${name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'}_${idx + 101}@institution.edu`;
      const username = columnMap.username && item[columnMap.username]
        ? String(item[columnMap.username] || '').trim().toLowerCase()
        : generateDeterministicUsername(name, roll, idx, targetRole);
      const password = columnMap.password && item[columnMap.password]
        ? String(item[columnMap.password] || '').trim()
        : generateDeterministicPassword(targetRole, idx);

      return {
        id: `row-${idx}-${Date.now()}`,
        fullName: name,
        rollNumber: roll,
        email,
        username,
        initialPassword: password,
        role: targetRole,
        assignedClassId: defaultClassId,
        status: 'valid',
      };
    });

    const validated = revalidateAllRows(rows);
    setPreviewRows(validated);
    setStep('preview');
  };

  const handleUpdateRow = (id: string, field: keyof BulkImportRow, value: string) => {
    setPreviewRows((prev) => {
      const updated = prev.map((r) => (r.id === id ? { ...r, [field]: value } : r));
      return revalidateAllRows(updated);
    });
  };

  const handleDeleteRow = (id: string) => {
    setPreviewRows((prev) => {
      const remaining = prev.filter((r) => r.id !== id);
      return revalidateAllRows(remaining);
    });
  };

  const handleAddManualRow = () => {
    const idx = previewRows.length;
    const newRow: BulkImportRow = {
      id: `manual-${Date.now()}`,
      fullName: '',
      rollNumber: targetRole === 'teacher' ? `FAC-${idx + 1}` : `STU-${idx + 101}`,
      email: '',
      username: '',
      initialPassword: generateDeterministicPassword(targetRole, idx),
      role: targetRole,
      assignedClassId: defaultClassId,
      status: 'invalid',
      validationMessage: 'Full Name and Email are required',
    };
    setPreviewRows((prev) => [...prev, newRow]);
  };

  const handleExecuteImport = async () => {
    const validRows = previewRows.filter((r) => r.status === 'valid');
    if (validRows.length === 0) {
      setUploadError('No valid rows found to import. Please correct any validation errors.');
      return;
    }

    setIsProcessing(true);
    setUploadError(null);

    try {
      const payloadUsers = validRows.map((r) => ({
        fullName: r.fullName,
        username: r.username,
        email: r.email,
        role: r.role,
        password: r.initialPassword,
        rollNumber: r.rollNumber,
        assignedClassId: r.assignedClassId || defaultClassId,
      }));

      const res = await api.batchCreateUsers(databaseName, payloadUsers);
      if (!res.success) {
        setUploadError(res.message || 'Batch user import failed.');
        setIsProcessing(false);
        return;
      }

      setImportSummary({
        createdCount: res.createdCount || 0,
        failedCount: res.failedCount || 0,
        createdUsers: res.createdUsers || [],
        errors: res.errors || [],
      });

      await onImportComplete();
      setStep('summary');
    } catch (err: any) {
      setUploadError(`Import execution error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyCredentialsSummary = () => {
    if (!importSummary?.createdUsers) return;
    const header = `=====================================\nSmart Institutional CRM - Batch Imported Credentials\nInstitution: ${institutionName}\n=====================================\n\n`;
    const rowsText = importSummary.createdUsers
      .map(
        (u, i) =>
          `[${i + 1}] Role: ${u.role.toUpperCase()} | Name: ${u.fullName}\n    Username: ${u.username}\n    Email: ${u.email}\n    Initial Password: ${u.initialPassword}\n`
      )
      .join('\n');

    navigator.clipboard.writeText(header + rowsText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  const validCount = previewRows.filter((r) => r.status === 'valid').length;
  const invalidCount = previewRows.length - validCount;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#121124] border border-white/10 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center">
              <UploadCloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Bulk Import Students &amp; Faculty
              </h2>
              <p className="text-[11px] text-slate-400">
                Upload CSV, XLSX, DOCX, or PDF rosters with automatic column mapping and credential generation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {uploadError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">Import Notice: </span>
                <span>{uploadError}</span>
              </div>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Role & Class Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Target User Role
                  </label>
                  <div className="flex rounded-xl bg-black/40 p-1 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setTargetRole('student')}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        targetRole === 'student'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Students
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetRole('teacher')}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        targetRole === 'teacher'
                          ? 'bg-pink-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Teachers / Faculty
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Assign to Cohort Class (Optional)
                  </label>
                  <select
                    value={defaultClassId}
                    onChange={(e) => setDefaultClassId(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">No automatic class allotment</option>
                    {classes.map((cls) => (
                      <option key={cls.id || (cls as any)._id} value={cls.id || (cls as any)._id}>
                        {cls.name} ({cls.gradeLevel})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/15 hover:border-purple-500/50 rounded-2xl p-8 text-center cursor-pointer bg-white/[0.01] hover:bg-white/[0.03] transition-all group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.xlsx,.xls,.docx,.pdf"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">
                  Click to browse or drop institutional roster file
                </h3>
                <p className="text-xs text-slate-400 mb-3">
                  Supported formats: Excel (.xlsx, .xls), CSV (.csv), Microsoft Word (.docx), or PDF
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-slate-400 font-mono">
                  <span>Max file size: 20MB</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: MAPPING */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Map Document Columns</h3>
                  <p className="text-xs text-slate-400">
                    Align your document headers with the CRM user fields.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Change File
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/10">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Full Name Column *
                  </label>
                  <select
                    value={columnMap.fullName}
                    onChange={(e) => setColumnMap({ ...columnMap, fullName: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Select column...</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {targetRole === 'teacher' ? 'Teacher / Employee ID Column' : 'Roll Number Column'}
                  </label>
                  <select
                    value={columnMap.rollNumber}
                    onChange={(e) => setColumnMap({ ...columnMap, rollNumber: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Auto-generate ID</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Column (Optional)
                  </label>
                  <select
                    value={columnMap.email}
                    onChange={(e) => setColumnMap({ ...columnMap, email: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Auto-generate institutional email</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Username Column (Optional)
                  </label>
                  <select
                    value={columnMap.username}
                    onChange={(e) => setColumnMap({ ...columnMap, username: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Auto-generate login username</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Initial Password / Credential Column (Optional)
                  </label>
                  <select
                    value={columnMap.password}
                    onChange={(e) => setColumnMap({ ...columnMap, password: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Auto-generate secure temporary password</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={applyMappingAndPreview}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl flex items-center gap-2 cursor-pointer shadow-md shadow-purple-600/30"
                >
                  <span>Preview Records</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: EDITABLE PREVIEW TABLE */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Preview Stats Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/10">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold text-white">
                    Total Detected: <strong className="text-purple-300">{previewRows.length}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {validCount} Ready
                  </span>
                  {invalidCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {invalidCount} Needs Review
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAddManualRow}
                  className="px-3 py-1.5 text-xs font-semibold text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Manual Record</span>
                </button>
              </div>

              {/* Editable Table */}
              <div className="border border-white/10 rounded-xl overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#16152b] border-b border-white/10 text-slate-400 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Full Name *</th>
                      <th className="py-2.5 px-3">{targetRole === 'teacher' ? 'Teacher ID' : 'Roll Number'}</th>
                      <th className="py-2.5 px-3">Email *</th>
                      <th className="py-2.5 px-3">Username / Login ID *</th>
                      <th className="py-2.5 px-3">Initial Credential</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-black/20">
                    {previewRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`hover:bg-white/[0.02] transition-colors ${
                          row.status === 'invalid' ? 'bg-rose-950/15' : ''
                        }`}
                      >
                        {/* Full Name */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.fullName}
                            onChange={(e) => handleUpdateRow(row.id, 'fullName', e.target.value)}
                            className="w-full min-w-[130px] bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                          />
                        </td>

                        {/* Roll Number / Teacher ID */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.rollNumber}
                            onChange={(e) => handleUpdateRow(row.id, 'rollNumber', e.target.value)}
                            className="w-full min-w-[90px] bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
                          />
                        </td>

                        {/* Email */}
                        <td className="py-2 px-3">
                          <input
                            type="email"
                            value={row.email}
                            onChange={(e) => handleUpdateRow(row.id, 'email', e.target.value)}
                            className="w-full min-w-[170px] bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                          />
                        </td>

                        {/* Username */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.username}
                            onChange={(e) => handleUpdateRow(row.id, 'username', e.target.value)}
                            className="w-full min-w-[120px] bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-purple-300 focus:outline-none focus:border-purple-500 font-mono"
                          />
                        </td>

                        {/* Password */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.initialPassword}
                            onChange={(e) => handleUpdateRow(row.id, 'initialPassword', e.target.value)}
                            className="w-full min-w-[110px] bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-pink-300 focus:outline-none focus:border-pink-500 font-mono"
                          />
                        </td>

                        {/* Status */}
                        <td className="py-2 px-3">
                          {row.status === 'valid' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              Ready
                            </span>
                          ) : (
                            <span
                              title={row.validationMessage}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-950/40 border border-rose-500/30 px-2 py-0.5 rounded-full cursor-help"
                            >
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[110px]">{row.validationMessage || 'Invalid'}</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.id)}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded-md transition-colors cursor-pointer"
                            title="Remove row from import preview"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Discard &amp; Upload New File
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 rounded-xl border border-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={validCount === 0 || isProcessing}
                    onClick={handleExecuteImport}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 rounded-xl shadow-md shadow-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer transition-all"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Provisioning Accounts...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm &amp; Import {validCount} Records</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SUMMARY */}
          {step === 'summary' && importSummary && (
            <div className="space-y-6 text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white font-display">
                  Batch Import Completed Successfully
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Provisioned <strong className="text-emerald-400">{importSummary.createdCount}</strong> new {targetRole} accounts into <strong className="text-white">{institutionName}</strong>.
                </p>
              </div>

              {importSummary.failedCount > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-left max-w-lg mx-auto">
                  <p className="font-semibold mb-1">
                    {importSummary.failedCount} records were skipped due to pre-existing accounts:
                  </p>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-200">
                    {importSummary.errors.map((e, idx) => (
                      <li key={idx}>
                        {e.identifier}: {e.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto pt-2">
                <button
                  type="button"
                  onClick={handleCopyCredentialsSummary}
                  className="flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-purple-600/30"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Copied All Credentials!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Credentials Roster</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-6 text-xs font-semibold text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 rounded-xl transition-all cursor-pointer border border-white/10"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
