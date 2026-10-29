import pymupdf, re, json, html, sys
d=pymupdf.open(sys.argv[1])
MONTHS="January February March April May June July August September October November December".split()
DRE=re.compile(r'^(%s) (\d{1,2})$'%'|'.join(MONTHS))
lines=[]  # (page, y, spans)
for pi,pg in enumerate(d):
    for b in pg.get_text('dict')['blocks']:
        for l in b.get('lines',[]):
            sp=[(s['font'],s['size'],s['text']) for s in l['spans']]
            if ''.join(t for _,_,t in sp).strip()=='' : continue
            lines.append((pi,l['bbox'][1],sp,l['bbox'][2]))
def fmt(sp):
    out=''
    for f,sz,t in sp:
        e=html.escape(t,quote=False)
        if 'BoldItalic' in f: e='<b><i>%s</i></b>'%e
        elif 'Bold' in f: e='<b>%s</b>'%e
        elif 'Italic' in f: e='<i>%s</i>'%e
        out+=e
    return out
entries=[];cur=None
prev=None
px1=0; ptxt=''
for pi,y,sp,x1 in lines:
    txt=''.join(t for _,_,t in sp).strip()
    m=DRE.match(txt)
    if m and sp[0][0]=='Times-Bold':
        cur={'m':MONTHS.index(m[1])+1,'d':int(m[2]),'title':'','verse':[],'paras':[],'_stage':'title'}
        entries.append(cur); prev=(pi,y); continue
    if cur is None: continue
    gap = (y-prev[1]) if prev and prev[0]==pi else 0
    newpara = gap>24 or (prev and prev[0]!=pi and px1<430 and re.search(r'[.!?"\']\s*$',ptxt))
    prev=(pi,y); px1=x1; ptxt=txt
    if cur['_stage']=='title':
        if sp[0][1]>17 and 'Bold' in sp[0][0]:
            cur['title']=(cur['title']+' '+txt).strip(); continue
        cur['_stage']='verse'
    if cur['_stage']=='verse':
        cur['verse'].append(sp)
        if any(('Italic' not in f) and t.strip() for f,_,t in sp):
            cur['_stage']='body0'
        continue
    if cur['_stage']=='body0':
        cur['_stage']='body'; newpara=True
    f=fmt(sp)
    if newpara or not cur['paras']: cur['paras'].append(f)
    else: cur['paras'][-1]+=(' ' if not cur['paras'][-1].endswith(' ') else '')+f
out=[]
def clean(s):
    s=re.sub(r'</b>\s*<b>',' ',s); s=re.sub(r'</i>\s*<i>',' ',s)
    s=re.sub(r'\s+',' ',s).strip()
    s=s.replace('<b> ','<b>').replace(' </b>','</b> ').replace('<i> ','<i>').replace(' </i>','</i> ')
    return re.sub(r'\s+',' ',s).strip()
for e in entries:
    vt='';vr=''
    for sp in e['verse']:
        for f,sz,t in sp:
            if 'Italic' in f: vt+=t
            else: vr+=t
    vt=re.sub(r'\s+',' ',vt+' ').strip(); vr=re.sub(r'\s+',' ',vr).strip()
    # a few verses may have ref within italic; leave
    out.append({'id':'%02d-%02d'%(e['m'],e['d']),'title':e['title'],'verse':vt,'ref':vr,
                'paras':[clean(p) for p in e['paras'] if clean(p)]})
json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False,indent=1)
print(len(out))
