import re,base64,os
s=open('src.html').read()
s=s.replace('<link rel="stylesheet" href="fonts.css">','<style>\n'+open('fonts.css').read()+'\n</style>')
cache={}
def sub(m):
    p=m.group(1)
    if p not in cache:
        mt={'png':'image/png','jpg':'image/jpeg','woff2':'font/woff2'}[p.rsplit('.',1)[1]]
        cache[p]=f'data:{mt};base64,'+base64.b64encode(open(p,'rb').read()).decode()
    return cache[p]
s=re.sub(r'(assets/[\w/.-]+\.(?:png|jpg|woff2))',sub,s)
s=s.replace('</body>',open('viewer.inc').read()+'</body>')
open('Mycond_Partnerska_prohrama.html','w').write(s)
print(os.path.getsize('Mycond_Partnerska_prohrama.html')//1024,'KB')
