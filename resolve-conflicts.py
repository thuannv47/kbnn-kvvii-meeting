"""
Script tu dong xoa conflict markers, GIU LAI phan code sau '<<<<<<< HEAD'
(ban moi co tinh nang Duyet cuoc hop + phan quyen tham gia),
XOA phan code sau '=======' (ban cu tren GitHub truoc do).

CACH CHAY:
1. Mo PowerShell, cd vao thu muc du an: cd C:\meeting-system
2. Chay: python resolve-conflicts.py
   (neu chua co Python: cai tai https://www.python.org/downloads/,
    nho tick "Add python.exe to PATH" luc cai dat)
3. Sau khi chay xong, kiem tra lai:
   findstr /S /M "<<<<<<< " *.ts *.tsx *.css
   -> Neu khong in ra gi la xong.
4. git add -A
   git commit -m "fix: resolve merge conflict markers"
   git push
"""
import glob

files = []
for pattern in ["**/*.ts", "**/*.tsx", "**/*.css"]:
    files.extend(glob.glob(pattern, recursive=True))

resolved = []
for path in files:
    with open(path, encoding="utf-8") as f:
        lines = f.readlines()
    if not any(l.startswith("<<<<<<< ") for l in lines):
        continue
    out = []
    mode = "normal"  # normal, ours, theirs
    for line in lines:
        if line.startswith("<<<<<<< "):
            mode = "ours"
            continue
        if line.startswith("======="):
            mode = "theirs"
            continue
        if line.startswith(">>>>>>> "):
            mode = "normal"
            continue
        if mode in ("normal", "ours"):
            out.append(line)
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(out)
    resolved.append(path)

print(f"Da xu ly {len(resolved)} file:")
for p in resolved:
    print(" -", p)
