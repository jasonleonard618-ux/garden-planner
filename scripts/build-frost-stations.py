# Builds src/data/frost-stations.json from NOAA 1991-2020 normals.
# Inputs: the normals access directory listing (access.html) and ghcnd-stations.txt from NCEI.
import re, json, urllib.request, urllib.parse, time, os, ssl
ids=re.findall(r'href="([A-Z0-9]+)\.csv"', open('access.html').read())
ids=[i for i in ids if i.startswith('US')]
coords={}
for l in open('st.txt'):
    coords[l[0:11]]=(float(l[12:20]),float(l[21:30]),l[41:71].strip(),l[38:40].strip())
ids=[i for i in ids if i in coords]
print(len(ids))
out={}
if os.path.exists('frost.json'): out=json.load(open('frost.json'))
todo=[i for i in ids if i not in out]
ctx=ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt')
proxy=urllib.request.ProxyHandler({'https':os.environ['HTTPS_PROXY']})
op=urllib.request.build_opener(proxy, urllib.request.HTTPSHandler(context=ctx))
for k in range(0,len(todo),50):
    b=todo[k:k+50]
    u='https://www.ncei.noaa.gov/access/services/data/v1?'+urllib.parse.urlencode({'dataset':'normals-annualseasonal-1991-2020','stations':','.join(b),'dataTypes':'ANN-TMIN-PRBLST-T32FP50,ANN-TMIN-PRBFST-T32FP50,ANN-TMIN-PRBGSL-T32FP50','format':'json'})
    for t in range(3):
        try:
            d=json.loads(op.open(u,timeout=120).read()); break
        except Exception as e: print('retry',e); time.sleep(3)
    else: continue
    got=set()
    for r in d:
        s=r['STATION']; got.add(s)
        L=r.get('ANN-TMIN-PRBLST-T32FP50','').strip(); F=r.get('ANN-TMIN-PRBFST-T32FP50','').strip()
        out[s]=[L,F] if L and F and '/' in L and '/' in F else None
    for s in b:
        if s not in got: out[s]=None
    json.dump(out,open('frost.json','w'))
    print(k, len(out), flush=True)
st=[]
for s,v in out.items():
    if not v: continue
    la,lo,name,state=coords[s]
    st.append([s,round(la,4),round(lo,4),name.title(),state,v[0],v[1]])
json.dump(st,open('stations.json','w'),separators=(',',':'))
print('final',len(st))
