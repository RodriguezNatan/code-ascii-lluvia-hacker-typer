from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import hashlib,json
root=Path(__file__).resolve().parents[1]
output=root.parent/'Paquetes'
output.mkdir(exist_ok=True)
game=root.parent/'Windows'
if not game.exists(): game=root/'dist'/'Hacker-Typer-Windows'
jobs=[('Hacker-Typer-Windows-portable.zip',game,set()),('Hacker-Typer-VSCode-desarrollo.zip',root,{'dist','runtime-download','datos'})]
for name,base,excluded in jobs:
    with ZipFile(output/name,'w',ZIP_DEFLATED,compresslevel=6) as z:
        for p in base.rglob('*'):
            rel=p.relative_to(base)
            if any(part in excluded for part in rel.parts):continue
            if 'test-results' in rel.parts and any(part.startswith('profile-') for part in rel.parts):continue
            if p.is_file():z.write(p,str(Path(base.name)/rel))
    path=output/name
    digest=hashlib.file_digest(path.open('rb'),'sha256').hexdigest()
    print(json.dumps({'file':str(path),'bytes':path.stat().st_size,'sha256':digest}))
    (output/(name+'.sha256')).write_text(digest+'  '+name+'\n')
with ZipFile(output/'Hacker-Typer-Windows-portable.zip') as z:
    appfiles=[n for n in z.namelist() if '/resources/app/' in n]
    assert not any(n.endswith('adminTools.js') for n in z.namelist())
    assert all(b'120426' not in z.read(n) for n in appfiles)
    assert any(n.endswith('/Hacker Typer.exe') for n in z.namelist())
    print('ZIP EXE publico: sin clave ni modulo ADMIN')

