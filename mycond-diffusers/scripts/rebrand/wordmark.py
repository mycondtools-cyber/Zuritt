"""Горизонтальний знак Mycond: дерево з офіційного логотипа + «MYCOND» (Proxima Nova Extrabold). Альфа-маска."""
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os
ROOT=os.path.join(os.path.dirname(__file__),'..','..')
FONT=os.path.join(ROOT,'public/fonts/ProximaNova-Extrabld.woff')
LOGO=os.path.join(ROOT,'public/brand/mycond-logo.png')

def tree_mask():
    im=np.array(Image.open(LOGO).convert('RGB')).astype(int)
    # білі пікселі на зеленому квадраті; дерево — верхня частина (над написом MYCOND)
    white=(im.min(axis=2)>200)
    rows=np.where(white.any(axis=1))[0]
    # шукаємо проміжок між деревом і текстом
    gaps=[r for r in range(rows.min(),rows.max()) if not white[r].any()]
    cut=gaps[0] if gaps else int(im.shape[0]*0.7)
    m=white[:cut]
    ys,xs=np.where(m)
    m=m[ys.min():ys.max()+1, xs.min():xs.max()+1]
    return Image.fromarray((m*255).astype(np.uint8))

def wordmark(height=200):
    """Повертає L-маску (255 = знак) висотою height."""
    font=ImageFont.truetype(FONT,int(height*0.82))
    text='MYCOND'
    l,t,r,b=font.getbbox(text)
    tw,th=r-l,b-t
    tree=tree_mask()
    th_tree=int(height*1.0)
    tree=tree.resize((int(tree.width*th_tree/tree.height),th_tree),Image.BICUBIC)
    # згладжування контуру піксельного джерела (125 px)
    from PIL import ImageFilter
    tree=tree.filter(ImageFilter.GaussianBlur(max(1,th_tree/45))).point(lambda v: 255 if v>140 else (0 if v<100 else int((v-100)*255/40)))
    gap=int(height*0.18)
    W=tree.width+gap+tw; H=max(th_tree,th)
    out=Image.new('L',(W,H),0)
    out.paste(tree,(0,(H-th_tree)//2))
    d=ImageDraw.Draw(out)
    d.text((tree.width+gap-l,(H-th)//2-t),text,font=font,fill=255)
    return out

if __name__=='__main__':
    m=wordmark(200); print(m.size, m.size[0]/m.size[1])
    rgb=Image.new('RGB',m.size,(255,255,255)); rgb.paste(Image.new('RGB',m.size,(0x4f,0xaf,0x4d)),(0,0),m)
    rgb.save('wordmark-preview.png')
