"""
Заміна логотипа AEROSTAR на знак MYCOND у тому ж місці фото.

  python3 scripts/rebrand/rebrand.py          # з assets/aerostar-originals/products → public/products

Потрібно: pip install opencv-python-headless pillow numpy
Зони логотипів — jobs.json: { "товар/NN.webp": [[x, y, ширина, висота] або [..., "bright"]] }.
"teal" (типово) — бірюзовий логотип; "bright" — світлий логотип на темному тлі.
"""
import cv2, numpy as np, json, os, sys
from PIL import Image
sys.path.insert(0,os.path.dirname(__file__))
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')
FONT=os.path.join(ROOT,'public/fonts/ProximaNova-Extrabld.woff')
# офіційний горизонтальний логотип (брендбук MYCOND 2024): білий знак на фірмовому зеленому
PLATE=cv2.imread(os.path.join(ROOT,'public/brand/mycond-logo-horizontal.png'))
SRC=os.path.join(ROOT,'assets/aerostar-originals/products')
DST=os.path.join(ROOT,'public/products')
HERE=os.path.dirname(__file__)

def teal_mask(img, loose=False):
    hsv=cv2.cvtColor(img,cv2.COLOR_BGR2HSV)
    lo=(76,28 if loose else 55,55); hi=(104,255,255)
    return cv2.inRange(hsv,lo,hi)

def bright_mask(sub):
    v=cv2.cvtColor(sub,cv2.COLOR_BGR2HSV)[...,2].astype(int)
    bg=int(np.percentile(v,40))
    return ((v>bg+45)*255).astype(np.uint8)

def process(img, region):
    mode='teal'
    if len(region)==5: mode=region[4]; region=region[:4]
    x,y,w,h=region
    H,W=img.shape[:2]
    x0,y0=max(0,x),max(0,y); x1,y1=min(W,x+w),min(H,y+h)
    sub=img[y0:y1,x0:x1]
    core=teal_mask(sub) if mode=='teal' else bright_mask(sub)
    loose=teal_mask(sub,True) if mode=='teal' else core
    # кольорові пікселі логотипа + м'які краї поруч із ними
    m=cv2.bitwise_and(loose,cv2.dilate(core,np.ones((5,5),np.uint8)))
    pts=cv2.findNonZero(core)
    if pts is None or len(pts)<10: return img,None
    hsv=cv2.cvtColor(sub,cv2.COLOR_BGR2HSV)
    sv=np.percentile(hsv[core>0][:,1:],75,axis=0)
    (cx,cy),(rw,rh),ang=cv2.minAreaRect(pts)
    if rw<rh: rw,rh=rh,rw; ang+=90
    if ang>90: ang-=180
    if ang<-90: ang+=180
    # прибрати: маска літер з запасом → заповнення фоном
    mask=np.zeros((H,W),np.uint8)
    mask[y0:y1,x0:x1]=cv2.dilate(m,np.ones((3,3),np.uint8),iterations=2 if mode=='teal' else 3)
    # колір панелі навколо логотипа; усе, що сильно від нього відрізняється (фон за краєм виробу),
    # тимчасово замінюємо цим кольором, щоб заповнення не затягувало білий фон у панель
    ring=cv2.dilate(mask,np.ones((9,9),np.uint8))&~mask
    med=np.median(img[ring>0],axis=0)
    win=cv2.dilate(mask,np.ones((25,25),np.uint8))>0
    tmp=img.copy()
    far=(np.abs(img.astype(int)-med).sum(axis=2)>70)&win&(mask==0)
    tmp[far]=med.astype(np.uint8)
    filled=cv2.inpaint(tmp,mask,4,cv2.INPAINT_TELEA)
    out=img.copy(); out[mask>0]=filled[mask>0]
    # поставити знак MYCOND: та сама ширина, кут і центр
    # офіційний логотип без змін кольору й пропорцій: ширина як у AEROSTAR, той самий центр і кут
    tw=max(8,int(round(rw*1.05))); th=max(3,int(round(tw*PLATE.shape[0]/PLATE.shape[1])))
    plate=cv2.resize(PLATE,(tw,th),interpolation=cv2.INTER_AREA).astype(np.float32)
    pad=int(max(tw,th)*0.6)+4
    cw,ch=tw+2*pad,th+2*pad
    canvas=np.zeros((ch,cw,3),np.float32); canvas[pad:pad+th,pad:pad+tw]=plate
    alpha=np.zeros((ch,cw),np.float32); alpha[pad:pad+th,pad:pad+tw]=1
    M=cv2.getRotationMatrix2D((cw/2,ch/2),-ang,1.0)
    rot=cv2.warpAffine(canvas,M,(cw,ch),flags=cv2.INTER_LINEAR)
    ra=cv2.warpAffine(alpha,M,(cw,ch),flags=cv2.INTER_LINEAR)
    # різкість як у фото: дрібні логотипи на фото злегка розмиті
    sigma=max(0.3,rh/40)
    rot=cv2.GaussianBlur(rot,(0,0),sigma); ra=cv2.GaussianBlur(ra,(0,0),sigma)
    gx,gy=int(cx+x0-cw/2),int(cy+y0-ch/2)
    ax0,ay0=max(0,gx),max(0,gy); ax1,ay1=min(W,gx+cw),min(H,gy+ch)
    a=ra[ay0-gy:ay1-gy, ax0-gx:ax1-gx][...,None]
    src=rot[ay0-gy:ay1-gy, ax0-gx:ax1-gx]/np.maximum(a,1e-3)
    roi=out[ay0:ay1,ax0:ax1].astype(np.float32)
    out[ay0:ay1,ax0:ax1]=np.clip(roi*(1-a)+src*a,0,255).astype(np.uint8)
    return out,(cx+x0,cy+y0,rw,rh,ang)

def banner_text(img):
    """rsdm/05: «ЩІЛИННИЙ ДИФУЗОР AEROSTAR RDSM» → «… MYCOND RDSM»"""
    from PIL import Image, ImageDraw, ImageFont
    x0,y0,x1,y1=40,338,490,384
    sub=img[y0:y1,x0:x1]
    hsv=cv2.cvtColor(sub,cv2.COLOR_BGR2HSV)
    m=((hsv[...,2]>170)&(hsv[...,1]<80)).astype(np.uint8)*255
    mask=np.zeros(img.shape[:2],np.uint8); mask[y0:y1,x0:x1]=cv2.dilate(m,np.ones((3,3),np.uint8),iterations=3)
    out=cv2.inpaint(img,mask,7,cv2.INPAINT_TELEA)
    ys,xs=np.where(m>0); top,bot,left=ys.min()+y0,ys.max()+y0,xs.min()+x0
    pil=Image.fromarray(cv2.cvtColor(out,cv2.COLOR_BGR2RGB))
    font=ImageFont.truetype(FONT,10)
    # підбираємо кегль під висоту великих літер оригіналу
    cap=bot-top+1
    size=10
    while True:
        f=ImageFont.truetype(font.path,size+1); l,t,r,b=f.getbbox('M')
        if b-t>cap: break
        size+=1
    f=ImageFont.truetype(font.path,size); l,t,r,b=f.getbbox('MYCOND RDSM')
    ImageDraw.Draw(pil).text((left-l,top-t),'MYCOND RDSM',font=f,fill=(255,255,255))
    return cv2.cvtColor(np.array(pil),cv2.COLOR_RGB2BGR)


if __name__=='__main__':
    jobs=json.load(open(os.path.join(HERE,'jobs.json')))
    dst=sys.argv[1] if len(sys.argv)>1 else DST
    report=[]
    for f,regions in jobs.items():
        img=cv2.imread(f'{SRC}/{f}')
        if f=='rsdm/05.webp': img=banner_text(img)
        for r in regions:
            img,info=process(img,r)
            report.append((f,r,info))
        os.makedirs(os.path.dirname(f'{dst}/{f}'),exist_ok=True)
        cv2.imwrite(f'{dst}/{f}',img,[cv2.IMWRITE_WEBP_QUALITY,92])
    print('done',len(jobs),'files',sum(1 for r in report if r[2]),'logos')

