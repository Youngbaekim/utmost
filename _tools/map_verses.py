import json,re,os,sys
B=os.path.expanduser('~/mnt/dev/devotion/bible')
en=json.load(open(os.path.expanduser('~/mnt/dev/Utmost/data/en.json')))
alias={'psalm':'psalms','song of solomon':'songofsolomon','canticles':'songofsolomon','revelations':'revelation'}
books={}
def load(name):
    f=re.sub(r'[^a-z0-9]','',name.lower())
    f=alias.get(name.lower(),f)
    if f not in books:
        p=f'{B}/{f}.json'
        books[f]=json.load(open(p)) if os.path.exists(p) else None
    return books[f]
out={};miss=[]
for e in en:
    ref=e['ref']
    m=re.match(r"^((?:[123] )?[A-Za-z ]+?)\.? (\d+)[:.](\d+)(?:\s*[-–,]\s*(\d+))?(?:\s*,\s*(\d+))?",ref)
    if not m: miss.append((e['id'],ref)); continue
    bk,ch,v1,v2=m[1],m[2],int(m[3]),m[4]
    d=load(bk)
    if not d or ch not in d['chapters']: miss.append((e['id'],ref)); continue
    v2=int(v2) if v2 else v1
    if v2<v1: v2=v1
    vs=[x for x in d['chapters'][ch] if v1<=x['n']<=v2]
    rng=f"{v1}" if v1==v2 else f"{v1}-{v2}"
    tail=re.sub(r'^.*?\d+(?:\s*[-–,]\s*\d+)*','',ref).strip()
    out[e['id']]={'name':d['name'],'ref':f"{d['name']} {ch}:{rng}",'tail':tail,'n':len(vs),
                  'text':' '.join(x['t'] for x in vs),'en_verse':e['verse']}
json.dump(out,open(os.path.expanduser('~/mnt/dev/Utmost/_tools/nkrv_raw.json'),'w'),ensure_ascii=False,indent=1)
print(len(out),'miss',miss)
import collections;print(collections.Counter(v['n'] for v in out.values()))
for k,v in out.items():
    if v['n']>=4: print(k,v['ref'],v['en_verse'][:60])
