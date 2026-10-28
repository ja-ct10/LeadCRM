"""Independent PDF link and QR checks; no network requests or CRM writes."""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / 'tmp/pdf-qa-deps'))
import zxingcpp
from pypdf import PdfReader

directory = root / 'output/pdf'
manifest_path = directory / 'leadcrm-source-links-verification.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
expected = {row['link'] for row in manifest['rows']}
reader = PdfReader(directory / 'leadcrm-lead-source-links.pdf')
targets, decoded = set(), set()
for page in reader.pages:
    for annotation in page.get('/Annots', []):
        action = annotation.get_object().get('/A', {})
        if action.get('/URI'):
            targets.add(str(action['/URI']))
    for image in page.images:
        decoded.update(result.text for result in zxingcpp.read_barcodes(image.image))
if targets != expected:
    raise ValueError(f'PDF annotation mismatch: missing {expected - targets}; unexpected {targets - expected}')
if decoded != expected:
    raise ValueError(f'QR mismatch: missing {expected - decoded}; unexpected {decoded - expected}')
text = ' '.join(' '.join(page.extract_text() for page in reader.pages).split())
for phrase in ['Others - Call / SMS', 'goldenbits.1993@gmail.com', 'still needs deployment']:
    if phrase not in text:
        raise ValueError('PDF missing required text: ' + phrase)
if 'localhost' in text:
    raise ValueError('Local preview link found in public copy')
manifest['pdfChecks'] = {'pages': len(reader.pages), 'clickableDestinations': len(targets), 'decodedQrTargets': len(decoded), 'allMatch': True}
manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(json.dumps(manifest['pdfChecks']))
