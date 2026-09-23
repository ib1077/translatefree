"""Read-only XLSX -> diagram-data.json. Python 3 standard library only.
Usage: python tools/extract_excel.py source.xlsx
Detects the two headings containing ①, のぼり/くだり; reads all train columns.
Layout changes that violate known structure fail explicitly instead of guessing.
"""
import argparse, hashlib, json, re, zipfile, xml.etree.ElementTree as ET
from pathlib import Path
N={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
def colnum(s):
 n=0
 for c in s:n=n*26+ord(c)-64
 return n
def colname(n):
 s=''
 while n:n,r=divmod(n-1,26);s=chr(65+r)+s
 return s
def extract(path):
 raw=Path(path).read_bytes();z=zipfile.ZipFile(path)
 strings=[]
 if 'xl/sharedStrings.xml' in z.namelist():
  for e in ET.fromstring(z.read('xl/sharedStrings.xml')):
   strings.append(''.join(t.text or '' for t in list(e.findall('s:t',N))+list(e.findall('s:r/s:t',N))))
 wb=ET.fromstring(z.read('xl/workbook.xml'));sheets=wb.findall('s:sheets/s:sheet',N)
 if len(sheets)!=1:raise ValueError('Expected the supplied one-sheet layout.')
 cells={}
 for e in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//s:sheetData/s:row/s:c',N):
  a=e.get('r');v=e.find('s:v',N);v=v.text if v is not None else None
  if e.get('t')=='s' and v is not None:v=strings[int(v)]
  elif e.get('t')=='inlineStr':v=''.join(t.text or '' for t in e.findall('s:is/s:t',N))
  elif v is not None and e.get('t') not in ['str','e']:v=float(v)
  cells[a]=v
 def get(c,r):return cells.get(f'{colname(c)}{r}')
 headings=[]
 for a,v in cells.items():
  if isinstance(v,str) and re.match(r'^(のぼり|くだり)①',v):
   c,r=re.fullmatch(r'([A-Z]+)(\d+)',a).groups();headings.append((colnum(c),int(r),'up' if 'のぼり' in v else 'down'))
 headings.sort()
 if len(headings)!=2:raise ValueError('Cannot locate both ① source blocks.')
 stations={};trains=[];warnings=[]
 for hidx,(sc,hr,direction) in enumerate(headings):
  rows=[];r=hr+2
  while isinstance(get(sc,r),str) and get(sc,r):rows.append(r);r+=1
  if len(rows)<2:raise ValueError('No station rows.')
  boundary=headings[hidx+1][0] if hidx+1<len(headings) else max(colnum(re.match('[A-Z]+',a)[0]) for a in cells)+1
  traincols=[c for c in range(sc+2,boundary) if isinstance(get(c,hr+1),str) and re.fullmatch(r'\d+[A-Za-z]*',get(c,hr+1))]
  if not traincols:raise ValueError('No train columns.')
  # Distance copy is the first station-name/numeric pair after the final train.
  candidates=[c for c in range(max(traincols)+2,boundary) if all(isinstance(get(c,r),float) and 0<=get(c,r)<1000 for r in rows) and isinstance(get(c-1,rows[0]),str)]
  if len(candidates)!=1:raise ValueError('Distance column is missing or ambiguous.')
  dc=candidates[0]
  for r in rows:
   name=get(sc,r);km=round(get(dc,r),8)
   if name in stations and stations[name]['km']!=km:raise ValueError(f'Inconsistent station distance: {name}')
   stations[name]={'id':name,'name':name,'km':km}
   if get(dc-1,r)!=name:warnings.append(f'{colname(dc-1)}{r}: 距離表の駅名「{get(dc-1,r)}」と時刻表の駅名「{name}」が不一致。時刻表の駅名と同じ行の数値を採用。')
  for c in traincols:
   trainid=get(c,hr+1);number=int(re.match(r'\d+',trainid)[0]);points=[]
   # Explicit dataset classification rule, independent of chart colors.
   service='hakuto' if trainid.endswith('D') and 51<=number<=66 else 'inaba' if trainid.endswith('D') and 71<=number<=82 else 'ordinary'
   for r in rows:
    v=get(c,r)
    if v is None:continue
    if not isinstance(v,float) or v<0 or v>=2:raise ValueError(f'Invalid time {colname(c)}{r}: {v}')
    second=round(v*86400)
    if abs(second-v*86400)>0.01:raise ValueError('Subsecond precision needs an explicit decision.')
    if points and second<points[-1]['seconds']:raise ValueError(f'Time reverses in {trainid}. Supply an explicit next-day serial; no automatic rollover.')
    event=get(sc+1,r)
    points.append({'station':get(sc,r),'seconds':second,'event':event or '', 'sourceCell':f'{colname(c)}{r}','excelSerial':v})
   if len(points)<2:raise ValueError(f'{trainid}: fewer than two points.')
   trains.append({'id':trainid,'direction':direction,'service':service,'points':points,'sourceColumn':colname(c)})
 if len({t['id'] for t in trains})!=len(trains):raise ValueError('Duplicate train IDs.')
 for t in trains:
  distances=[stations[p['station']]['km'] for p in t['points']]
  if any((b-a)*(1 if t['direction']=='up' else -1)>0 for a,b in zip(distances,distances[1:])):raise ValueError('Distance reverses unexpectedly.')
 return {'schemaVersion':1,'title':'智頭線 ダイヤ図','source':{'file':Path(path).name,'sheet':sheets[0].get('name'),'sha256':hashlib.sha256(raw).hexdigest(),'note':'元Excelの①着発時刻を秒単位で収録。適用日は元資料から確定できません。'},'view':{'startSeconds':18000,'endSeconds':82800,'gridMinutes':10},'classificationNote':'この元資料に対する明示ルール: 51D–66D=はくと、71D–82D=いなば。列車番号体系が変わる場合はここを見直す。色からの分類はしない。','stations':sorted(stations.values(),key=lambda s:s['km']),'trains':trains,'warnings':warnings}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('--output',default=str(Path(__file__).resolve().parent.parent/'diagram-data.json'));a=p.parse_args()
 result=extract(a.source);out=Path(a.output)
 if out.resolve()==Path(a.source).resolve():raise ValueError('Output must not overwrite the source.')
 out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 print(f'{len(result["trains"])} trains / {sum(len(t["points"]) for t in result["trains"])} points -> {out}')
