export const PHASES = [
  { id: "p1", title: "Phase 01 — Foundations", topics: ["Networking basics", "Linux CLI", "Operating systems", "TCP/IP"] },
  { id: "p2", title: "Phase 02 — Security Essentials", topics: ["CIA triad", "Cryptography", "Authentication", "Hashing"] },
  { id: "p3", title: "Phase 03 — Offensive Basics", topics: ["Recon", "Scanning (nmap)", "Web app vulns (OWASP Top 10)", "Exploits"] },
  { id: "p4", title: "Phase 04 — Defensive Basics", topics: ["SIEM", "Log analysis", "Incident response", "Hardening"] },
  { id: "p5", title: "Phase 05 — Advanced Offense", topics: ["Active Directory", "Privilege escalation", "C2 frameworks", "Reverse engineering"] },
  { id: "p6", title: "Phase 06 — Specialization", topics: ["Cloud security", "Mobile pentest", "Malware analysis", "Red teaming"] },
];

export const BRANCHES = [
  { id: "pentester", title: "Penetration Tester", subtitle: "Offensive security", skills: ["Web", "Network", "AD"], salary: "$80k–$150k" },
  { id: "soc", title: "SOC Analyst", subtitle: "Defensive ops", skills: ["SIEM", "Triage", "Forensics"], salary: "$55k–$110k" },
  { id: "ir", title: "Incident Responder", subtitle: "Breach handling", skills: ["DFIR", "Memory analysis"], salary: "$80k–$140k" },
  { id: "redteam", title: "Red Teamer", subtitle: "Adversary emulation", skills: ["C2", "AD", "OPSEC"], salary: "$120k–$200k" },
  { id: "blueteam", title: "Blue Teamer", subtitle: "Defense engineering", skills: ["Detection", "Hardening"], salary: "$80k–$140k" },
  { id: "appsec", title: "Application Security", subtitle: "Code & web", skills: ["SAST", "Secure SDLC"], salary: "$100k–$170k" },
  { id: "cloud", title: "Cloud Security", subtitle: "AWS/Azure/GCP", skills: ["IAM", "K8s", "Terraform"], salary: "$110k–$180k" },
  { id: "malware", title: "Malware Analyst", subtitle: "Reverse eng", skills: ["IDA", "Ghidra", "Sandboxing"], salary: "$95k–$160k" },
  { id: "forensics", title: "Digital Forensics", subtitle: "Evidence handling", skills: ["Disk", "Memory", "Mobile"], salary: "$70k–$130k" },
  { id: "grc", title: "GRC / Compliance", subtitle: "Policy & risk", skills: ["ISO27001", "SOC2"], salary: "$70k–$130k" },
  { id: "hunter", title: "Threat Hunter", subtitle: "Proactive detection", skills: ["MITRE ATT&CK", "Telemetry"], salary: "$95k–$160k" },
  { id: "research", title: "Security Researcher", subtitle: "Vuln discovery", skills: ["Fuzzing", "RE", "Exploit dev"], salary: "$110k–$200k" },
];

export const LANGUAGES = [
  { name: "Python", priority: "MUST", proficiency: 5, useCase: "Scripting, automation, exploit dev" },
  { name: "Bash", priority: "MUST", proficiency: 4, useCase: "Linux automation" },
  { name: "JavaScript", priority: "SHOULD", proficiency: 4, useCase: "Web exploitation, XSS payloads" },
  { name: "C / C++", priority: "SHOULD", proficiency: 4, useCase: "Memory exploits, low-level" },
  { name: "Go", priority: "NICE", proficiency: 3, useCase: "Modern tooling, C2" },
  { name: "PowerShell", priority: "MUST", proficiency: 4, useCase: "Windows / AD attacks" },
  { name: "SQL", priority: "MUST", proficiency: 4, useCase: "SQLi, data analysis" },
  { name: "Assembly", priority: "NICE", proficiency: 3, useCase: "Reverse engineering" },
];

export const CERTIFICATIONS = [
  { name: "CompTIA Security+", level: "Beginner", difficulty: "Easy", desc: "Industry-standard entry cert" },
  { name: "eJPT", level: "Beginner", difficulty: "Easy", desc: "Practical pentest fundamentals" },
  { name: "PNPT", level: "Intermediate", difficulty: "Medium", desc: "Practical Network Pentest" },
  { name: "OSCP", level: "Intermediate", difficulty: "Hard", desc: "Hands-on offensive cert" },
  { name: "CRTO", level: "Intermediate", difficulty: "Medium", desc: "Red team ops" },
  { name: "OSEP", level: "Advanced", difficulty: "Hard", desc: "Evasion & advanced AD" },
  { name: "OSED", level: "Advanced", difficulty: "Very Hard", desc: "Exploit development" },
  { name: "CISSP", level: "Advanced", difficulty: "Hard", desc: "Management & GRC" },
];

export const RESOURCES = [
  { name: "PortSwigger Web Security Academy", url: "https://portswigger.net/web-security", desc: "Free web vuln labs" },
  { name: "HackTheBox", url: "https://www.hackthebox.com", desc: "Pentesting practice" },
  { name: "TryHackMe", url: "https://tryhackme.com", desc: "Beginner-friendly rooms" },
  { name: "OverTheWire", url: "https://overthewire.org/wargames/", desc: "Linux & networking wargames" },
  { name: "MITRE ATT&CK", url: "https://attack.mitre.org", desc: "TTPs reference" },
  { name: "John Hammond (YouTube)", url: "https://www.youtube.com/@_JohnHammond", desc: "CTF walkthroughs" },
  { name: "IppSec (YouTube)", url: "https://www.youtube.com/@ippsec", desc: "HTB walkthroughs" },
  { name: "LiveOverflow (YouTube)", url: "https://www.youtube.com/@LiveOverflow", desc: "Low-level + RE" },
];

export const CAREER_GOALS = BRANCHES.map((b) => ({ value: b.id, label: b.title }));
