Design system, architecture, and constraints for NotesFriendly

## Architecture
- Student IDs (CS01-CS61, BS01-BS60) mapped to emails: `{id}@students.notesfriendly.app`
- Auto-confirm enabled (no real emails)
- God account: id=god, god role must be granted manually (NOT via signup metadata)
- First login = auto-signup, subsequent = sign-in

## Database Tables
- profiles (id, student_id, division, name, reg_no, avatar_url)
- user_roles (user_id, role enum: student/admin/god)
- messages (from_user_id, to_user_id, text, group_id) - realtime enabled
- chat_groups (id, name, created_by, avatar_url)
- chat_group_members (group_id, user_id, joined_at) - unique per group+user
- posts (subject_code, author_id, text)
- post_replies (post_id, parent_reply_id, author_id, text)
- post_reactions (post_id, reply_id, user_id, emoji)
- activity_logs (user_id, action, details, page) - god-only read

## Design
- Login text "CS01–CS61 • BS01–BS60" must be invisible (text-transparent select-none)
- Login has remember me checkbox and show password toggle
- Glass morphism UI with rounded-xl cards

## Subjects
- NNSCS supports file/image uploads (not posts-only)
- SS is posts-only
- All other subjects have notes/labs/records/assignments folders

## Security
- Passwords are cryptographically hashed - CANNOT be viewed by anyone
- God can only RESET passwords, never view them
- user_passwords table was REMOVED (plaintext storage is insecure)
- Seed users get random passwords returned ONCE for distribution via CSV
- handle_new_user trigger always assigns 'student' role (never god from metadata)
