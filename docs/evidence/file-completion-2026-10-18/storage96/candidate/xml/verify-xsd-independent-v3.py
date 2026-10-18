"""Independent readers: libxml2 XSD1.0 plus exact rational oracle for its digit limit.
Own XML only. Network/DTD/entity loading disabled. Never adapts product validation.
"""
import sys,json,hashlib,re
from fractions import Fraction
from pathlib import Path
from lxml import etree as E
folder=Path(sys.argv[1]).resolve(); report=Path(sys.argv[2]).resolve()
assert not report.exists(), 'new report path required'
sha=lambda b:hashlib.sha256(b).hexdigest()
parser=E.XMLParser(resolve_entities=False,load_dtd=False,no_network=True)
rows=json.loads((folder/'oracle-matrix.json').read_text(encoding='utf-8'))
observed={r['id']:r for r in json.loads((folder/'result.json').read_text(encoding='utf-8'))['oracleObservations']}
results=[];failures=[];limitations=[]
XS='{http://www.w3.org/2001/XMLSchema}'
def rational(text):
 text=re.sub('[\\t\\r\\n ]+',' ',text).strip(' ')
 assert re.fullmatch(r'[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)',text)
 return Fraction(text)
for case in rows:
 row={'id':case['id'],'schemaSha256':sha(case['schema'].encode()),'values':[]}
 try:
  schema=E.XMLSchema(E.fromstring(case['schema'].encode(),parser));row['schemaValid']=True;row['oracle']='libxml2 XSD1.0'
 except E.XMLSchemaParseError as err:
  row['schemaValid']=False;row['schemaErrorType']=type(err).__name__
  if case['id']=='precise-decimal-range' or case['id'].startswith('same-inherited-exclusive-'):
   # libxml2 rejects this specification-valid precision. Keep the refusal visible,
   # then compare actual lexical values by independently implemented exact rationals.
   row['libxmlSchemaValid']=False;row['schemaValid']=True;row['oracle']='Python fractions.Fraction, exact base10 rational'
   row['libxmlDiagnostic']=str(err)
   tree=E.fromstring(case['schema'].encode(),parser)
   lower=[];upper=[]
   for tag,collection,exclusive in [('minInclusive',lower,False),('minExclusive',lower,True),('maxInclusive',upper,False),('maxExclusive',upper,True)]:
    for node in tree.findall('.//'+XS+tag):collection.append((rational(node.get('value')),exclusive))
   lo=max(lower,key=lambda n:(n[0],n[1]));hi=min(upper,key=lambda n:(n[0],not n[1]));assert lo[0]<hi[0]
   if case['id'].startswith('same-inherited-exclusive-'):
    row['primarySource']='https://www.w3.org/TR/xmlschema-2/#rf-minExclusive' if '-min-' in case['id'] else 'https://www.w3.org/TR/xmlschema-2/#rf-maxExclusive'
    row['primaryConstraint']='Exclusive facet definition explicitly permits a value equal to the inherited exclusive bound. Repeated bounds do not alter its exact mathematical interval. libxml2 refuses this declaration; its disagreement is retained, not used to over-reject the supported profile.'
    limitations[-1]={'id':case['id'],'scope':'libxml2 declaration refusal differs from the W3C facet definition same-bound exception','diagnostic':str(err),'primarySource':row['primarySource'],'replacementOracle':'W3C same-bound exception and independent exact Fraction interval, no float conversion or skipped values'}
 if row['schemaValid']!=case['schemaValid'] or row['schemaValid']!=observed[case['id']]['schemaValid']:failures.append(case['id']+': schema mismatch')
 if row['schemaValid']:
  for index,value in enumerate(case['values']):
   if row['oracle'].startswith('Python'):
    text=E.fromstring(value['xml'].encode(),parser).text;number=rational(text);actual=(number>lo[0] if lo[1] else number>=lo[0])and(number<hi[0]if hi[1]else number<=hi[0])
   else:actual=schema.validate(E.fromstring(value['xml'].encode(),parser))
   row['values'].append({'inputSha256':sha(value['xml'].encode()),'valid':actual})
   if actual!=value['valid'] or actual!=observed[case['id']]['values'][index]:failures.append(case['id']+': value '+str(index))
 results.append(row)
source=(folder/'own.xml').read_bytes();download=(folder/'downloads/own.xml').read_bytes();schema_bytes=(folder/'own.xsd').read_bytes();schema_download=(folder/'downloads/own.xsd').read_bytes()
assert schema_bytes==schema_download,'XSD source changed during export'
schema=E.XMLSchema(E.fromstring(schema_bytes,parser));tree=E.fromstring(download,parser);assert schema.validate(tree),'exported XML schema invalid'
ns={'p':'urn:own95'};assert tree.find('p:title',ns).xpath('string()')=='수정 <값> & 😀';assert tree.find('p:status',ns).text=='완료';assert tree.find('p:amount',ns).text=='9007199254740992.2';assert len(tree.xpath('//comment()'))==2
artifact={'xmlSourceSha256':sha(source),'xmlExportSha256':sha(download),'schemaSourceSha256':sha(schema_bytes),'schemaExportSha256':sha(schema_download),'oracle':'libxml2 XSD1.0','schemaValid':True,'comments':2,'exactFields':True}
value={'scope':'Independent only; not general XSD support. Own fixtures, all matrix values compared; actual downloaded artifact schema fully compiled by libxml2. No production projection/ignored failures.','lxmlVersion':E.LXML_VERSION,'libxmlVersion':E.LIBXML_VERSION,'results':results,'artifact':artifact,'limitations':limitations,'failures':failures,'scriptSha256':sha(Path(__file__).read_bytes())}
report.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'schemas':len(results),'values':sum(len(r['values'])for r in results),'failures':len(failures),'limitations':len(limitations),'artifact':artifact},indent=2));sys.exit(bool(failures))
