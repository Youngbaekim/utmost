import json,sys
a=json.load(open(sys.argv[1])); m={x['id']:x for x in a}
for x in a:
    v=x['verse']
    if v and not v.startswith('"') and not v.startswith('. .'): x['verse']='"'+v
x=m['08-01']; x['paras'][0:2]=['<b>He comes where He commands us to leave.</b> '+x['paras'][0]+' '+x['paras'][1]] if False else x['paras'][0:2]
x['paras'].insert(0,'<b>'+x['ref']+'</b>'); x['ref']=''
x=m['05-31']; x['verse']='"Jesus did not commit Himself unto them . . . for He knew what was in man."'
p0=x['paras'].pop(0); x['ref']='John 2:24-25'; x['paras'][0]='<b>Put God First in Trust.</b> '+x['paras'][0]
m['11-15']['ref']='John 21:21-22'
json.dump(a,open(sys.argv[2],'w'),ensure_ascii=False,indent=1)
