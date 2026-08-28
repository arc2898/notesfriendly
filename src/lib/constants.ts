// Subject and course data for NotesFriendly

export type Division = "CS" | "BS" | "IT";
export type UserRole = "student" | "admin" | "god";

export interface UserData {
  id: string; // student_id e.g. CS01
  division: Division;
  role: UserRole;
  name: string;
  regNo: string;
  avatarUrl?: string;
  bio?: string;
  supabaseId?: string; // UUID from auth.users
}

export interface SubjectInfo {
  code: string;
  name: string;
  hasNotes: boolean;
  hasLabs: boolean;
  labName?: string;
  hasRecords: boolean;
  hasAssignments: boolean;
}

export const SUBJECTS: SubjectInfo[] = [
  { code: "EP", name: "Engineering Physics", hasNotes: true, hasLabs: true, labName: "EPL", hasRecords: true, hasAssignments: true },
  { code: "DS", name: "Data Structures", hasNotes: true, hasLabs: true, labName: "DSL", hasRecords: false, hasAssignments: true },
  { code: "DEVC", name: "Development in C", hasNotes: true, hasLabs: false, hasRecords: false, hasAssignments: true },
  { code: "EG", name: "Engineering Graphics", hasNotes: true, hasLabs: false, hasRecords: false, hasAssignments: false },
  { code: "BEEE", name: "Basic Electrical & Electronics", hasNotes: true, hasLabs: false, hasRecords: true, hasAssignments: true },
  { code: "IT", name: "Information Technology", hasNotes: false, hasLabs: true, labName: "IT", hasRecords: false, hasAssignments: false },
  { code: "SS", name: "Soft Skills", hasNotes: false, hasLabs: false, hasRecords: false, hasAssignments: false },
  { code: "NNSCS", name: "NCC/NSS/Sports/Cultural", hasNotes: true, hasLabs: false, hasRecords: false, hasAssignments: false },
];

export const SEMESTERS = [
  { id: 1, label: "Sem 1", enabled: false },
  { id: 2, label: "Sem 2", enabled: true },
  { id: 3, label: "Sem 3", enabled: false },
  { id: 4, label: "Sem 4", enabled: false },
  { id: 5, label: "Sem 5", enabled: false },
  { id: 6, label: "Sem 6", enabled: false },
  { id: 7, label: "Sem 7", enabled: false },
  { id: 8, label: "Sem 8", enabled: false },
];

export const SUBJECT_COLORS: Record<string, string> = {
  EP: "from-blue-500 to-cyan-400",
  DS: "from-violet-500 to-purple-400",
  DEVC: "from-emerald-500 to-teal-400",
  EG: "from-orange-500 to-amber-400",
  BEEE: "from-rose-500 to-pink-400",
  IT: "from-indigo-500 to-blue-400",
  SS: "from-yellow-500 to-orange-300",
  NNSCS: "from-teal-500 to-green-400",
};

export const DIVISIONS: Division[] = ["CS", "BS", "IT"];

export function generateUserIds(): string[] {
  const ids: string[] = [];
  for (let i = 1; i <= 61; i++) ids.push(`CS${String(i).padStart(2, "0")}`);
  for (let i = 1; i <= 60; i++) ids.push(`BS${String(i).padStart(2, "0")}`);
  for (let i = 1; i <= 60; i++) ids.push(`IT${String(i).padStart(2, "0")}`);
  return ids;
}

export function getDivision(userId: string): Division {
  const up = userId.toUpperCase();
  if (up.startsWith("CS")) return "CS";
  if (up.startsWith("IT")) return "IT";
  return "BS";
}

export function isValidUser(id: string): boolean {
  if (id === "god") return true;
  const validIds = generateUserIds();
  return validIds.includes(id.toUpperCase());
}
