"""Read-only native XLSX checks; does not author or modify the workbook."""
import json
from pathlib import Path
import re
import zipfile
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
FILE=PROJECT/'outputs/01a192d1-2f30-7532-a754-39dbb9ba9e30/Matching-QA.xlsx'
NS={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(FILE) as archive:
    workbook=ET.fromstring(archive.read('xl/workbook.xml'))
    names=[s.attrib['name'] for s in workbook.find('s:sheets',NS)]
    assert len(names)==17
    assert names[:3]==['Users & Credentials','Run Guide','System Flow']
    strings=[]
    if 'xl/sharedStrings.xml' in archive.namelist():
        strings=[''.join(si.itertext()) for si in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
    def cells(index):
        sheet=ET.fromstring(archive.read(f'xl/worksheets/sheet{index}.xml'))
        result={}
        for c in sheet.findall('.//s:sheetData/s:row/s:c',NS):
            value=c.find('s:v',NS)
            if c.attrib.get('t')=='s':text=strings[int(value.text)] if value is not None else ''
            elif c.attrib.get('t')=='inlineStr':text=''.join(c.find('s:is',NS).itertext())
            else:text=value.text if value is not None else ''
            result[c.attrib['r']]=text
        return sheet,result
    roster,rc=cells(1)
    aliases=[rc.get(f'A{r}') for r in range(7,10007)]
    assert len(set(aliases))==10000
    assert aliases[0]=='qa00001' and aliases[-1]=='qa10000'
    assert float(rc['B4'])==10000
    guide,gc=cells(2)
    expected={'B22':134,'C22':108,'D22':107,'E22':1,'F22':3,'G22':23,'H22':0}
    for cell,value in expected.items():assert float(gc[cell])==value,(cell,gc[cell])
    total_cases=0
    statuses={'PASS':0,'FAIL':0,'BLOCKED':0,'NOT RUN':0}
    cases=set()
    panes=[]
    for i,name in enumerate(names,1):
        sheet,data=cells(i)
        if i==1 or i>=4:
            pane=sheet.find('.//s:pane',NS)
            assert pane is not None
            assert float(pane.attrib.get('xSplit',0))==2,(name,pane.attrib)
            assert float(pane.attrib.get('ySplit',0))==6,(name,pane.attrib)
            panes.append(name)
        if i>=4:
            validation=sheet.findall('s:dataValidations/s:dataValidation',NS)
            assert len(validation)==2,(name,len(validation))
            assert sheet.find('s:tableParts',NS) is not None
            ids=[(cell,value) for cell,value in data.items() if re.fullmatch(r'A(?:[7-9]|[1-9]\d+)',cell) and value]
            for cell,case_id in ids:
                row=int(cell[1:]);status=data[f'N{row}']
                assert case_id not in cases;cases.add(case_id)
                statuses[status]+=1;total_cases+=1
                assert data.get(f'H{row}') and data.get(f'I{row}')
                if status in ['PASS','FAIL']:assert data.get(f'O{row}')=='Codex'
    assert total_cases==134
    assert statuses=={'PASS':107,'FAIL':1,'BLOCKED':3,'NOT RUN':23}
    tables=[n for n in archive.namelist() if re.fullmatch(r'xl/tables/table\d+\.xml',n)]
    assert len(tables)==15
    for name in tables:
        tree=ET.fromstring(archive.read(name))
        assert tree.find('s:autoFilter',NS) is not None
    # Export may preserve declared size while count cells must all be cached correctly.
    assert all(float(gc[c])==v for c,v in expected.items())
    xml='\n'.join(archive.read(n).decode('utf-8') for n in archive.namelist() if n.endswith('.xml'))
    env=(ROOT/'.env.qa').read_text(encoding='utf-8')
    for key in ['JWT_SECRET','OTP_HASH_SECRET','MATCHING_AI_KEY']:
        secret=re.search(rf'^{key}=(.+)$',env,re.M).group(1).strip()
        assert secret not in xml,f'{key} must not be exported to the workbook'
report={'file':str(FILE),'bytes':FILE.stat().st_size,'sheets':len(names),'persistedRosterRows':10000,'nativeTableCount':len(tables),'moduleCaseCount':total_cases,'statusCounts':statuses,'filtersVerified':True,'freezeRowsAndColumnsVerified':len(panes),'statusDropdownsVerified':True,'cachedSummaryMatchesSource':True,'qaSecretsAbsent':True}
(ROOT/'results/xlsx-structure.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
