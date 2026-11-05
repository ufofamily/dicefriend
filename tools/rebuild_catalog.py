"""Converts previously extracted local ATMOSLAM Forensics reports into a compact read-only catalogue.
No audio is copied or embedded. Run with Python 3.10+ and stdlib only.
"""
import glob,json,os,re,collections,argparse
from pathlib import Path
parser=argparse.ArgumentParser(description='Convert extracted ATMOSLAM Sample Forensics reports into compact JS catalogue')
parser.add_argument('reports',help='Directory containing extracted forensics.json reports, recursively')
parser.add_argument('--output',default=str(Path(__file__).resolve().parents[1]/'src'/'forensicsCatalog.js'))
args=parser.parse_args()
source=os.path.abspath(args.reports)
target=os.path.abspath(args.output)
rows=[];seen=set()
for f in sorted(glob.glob(source+'/**/*forensics.json',recursive=True)):
 d=json.load(open(f,encoding='utf8'));s=d['features']['source'];sha=s['sha256']
 if sha in seen:continue
 seen.add(sha)
 name=s['filename'];lc=name.lower()
 if 'ritual environments' in lc:collection='Ritual Environments'
 elif 'percussions collection' in lc:collection='TEK Percussions'
 elif 'bassline collection 002' in lc:collection='TEK Basslines II'
 elif 'bassline collection' in lc:collection='TEK Basslines I'
 elif 'phyllorum' in lc:collection='Phyllorum Horror'
 else:collection='Test & Misc'
 sp=d['features']['spectrum'];ev=d['features']['envelope'];st=d['features']['stereo'];rh=d['rhythm'];ton=d['features']['tonality']; trans=d['features']['transient']
 band=sp['bands_energy_fraction'];kind=d['recreation']['primary_category_guess'];timing=rh['timing'];f0=ton.get('f0_candidate') or {};sm=rh['summary'];groove=sm['groove'];struc=sm['structure']
 # The source reports don't imply accurate source separation or note transcription.
 rows.append({
  'id':sha[:12], 'name':name, 'collection':collection,
  'category':kind, 'confidence':d['recreation'].get('category_confidence_heuristic',0),
  'duration':round(s['full_duration_sec'],3), 'rms':s['rms_dbfs'], 'crest':s['crest_factor_db'],
  'attack':ev.get('attack_10_90_ms'), 'tail':ev.get('duration_to_minus40db_ms'),
  'active':ev.get('active_fraction'), 'centroid':sp.get('spectral_centroid_hz'),
  'flatness':sp.get('spectral_flatness'), 'low':round(sum(band.get(x,0) for x in ['sub_20_60','bass_60_150']),4),
  'mid':round(sum(band.get(x,0) for x in ['low_mid_150_500','mid_500_2000']),4),
  'high':round(sum(band.get(x,0) for x in ['upper_mid_2000_6000','high_6000_10000']),4),
  'width':st.get('side_to_mid_rms'),
  'bpm':timing.get('bpm'), 'bpmProvenance':timing.get('bpm_provenance'),
  'events':sm['total_events'], 'bars':sm['bars'],
  'ghost':groove.get('ghost_ratio',0), 'offbeat':groove.get('offbeat_ratio',0), 'deviation':groove.get('offset_std_ms',0),
  'cycles':struc.get('cycle_candidates',[])[:3],
  'f0':round(f0['median_f0_hz'],2) if f0.get('available') and f0.get('median_relative_deviation',1)<.15 else None,
  'harmonic':ton.get('harmonic_spectral_fraction_est',0),
  'clickRatio':trans.get('click_later_to_early_ratio'),
  'subClickDb':trans.get('sub_to_click_level_db'),
  'ridge': [trans.get('low_ridge_early_median_hz'),trans.get('low_ridge_late_median_hz')],
  'patterns':rh['bars'][0].get('patterns',{}) if rh['bars'] else {}
 })
rows.sort(key=lambda r:(r['collection'],r['name'],r['id']))
with open(target,'w',encoding='utf8') as out:
 out.write(f'// Derived from {len(rows)} unique forensics.json analyses. No audio is embedded.\n')
 out.write('// These are approximate DSP reconstruction references, not the original sample packs or VST presets.\n')
 out.write('export const forensicsCatalog = '+json.dumps(rows,ensure_ascii=False,separators=(',',':'))+';\n')
print('generated',len(rows),'unique records',os.path.getsize(target),'bytes',collections.Counter(r['collection'] for r in rows))
