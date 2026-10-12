"""Build the downloadable extension with deterministic ZIP metadata."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
extension = root / 'browser-extension'
(extension / 'tec-protocol.js').write_bytes((root / 'src/lib/tecProtocol.js').read_bytes())
with ZipFile(root / 'public/ritmo-marcacoes-extension.zip', 'w', compression=ZIP_DEFLATED) as archive:
    for path in sorted(extension.iterdir()):
        if path.is_file() and path.suffix in {'.js', '.json', '.html', '.css', '.md'}:
            info = ZipInfo(path.name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_bytes())
print('Extensão empacotada: public/ritmo-marcacoes-extension.zip')
