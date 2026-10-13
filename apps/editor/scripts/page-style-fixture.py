"""Alter one generated header for unsupported-style validation; preserve XML prefixes."""
import sys,zipfile,re
source,target,mode,identifier=sys.argv[1:5]
with zipfile.ZipFile(source) as original,zipfile.ZipFile(target,'w') as output:
    for item in original.infolist():
        data=original.read(item.filename)
        if item.filename=='Contents/header.xml':
            text=data.decode('utf8')
            if mode=='threeD':
                pattern=r'(<hh:borderFill\b[^>]*\bid="'+re.escape(identifier)+r'"[^>]*\bthreeD=")0(")'
                text,count=re.subn(pattern,r'\g<1>1\2',text);assert count==1,count
            elif mode in ('shadow','diagonal','alpha'):
                pattern=r'<hh:borderFill\b[^>]*\bid="'+re.escape(identifier)+r'"[^>]*>.*?</hh:borderFill>'
                def alter(m):
                    body=m.group(0)
                    if mode=='shadow':body,count=re.subn(r'shadow="0"','shadow="1"',body,count=1)
                    elif mode=='diagonal':body,count=re.subn(r'(<hh:slash\s+type=")NONE',r'\g<1>CENTER',body,count=1)
                    else:body,count=re.subn(r'alpha="0"','alpha="40"',body,count=1)
                    assert count==1,(mode,count)
                    return body
                text,count=re.subn(pattern,alter,text,flags=re.S);assert count==1,count
            elif mode=='three-colors':
                def replace(m):
                    body=m.group(0);body=re.sub(r'colorNum="2"','colorNum="3"',body);return body.replace('</hc:gradation>','<hc:color value="#778899"/></hc:gradation>')
                text,count=re.subn(r'<hc:gradation\b[^>]*>.*?</hc:gradation>',replace,text,count=1,flags=re.S);assert count==1,count
            else:raise ValueError(mode)
            data=text.encode('utf8')
        output.writestr(item,data)
