import numpy as np, math, sys
from PIL import Image
N=16; SZ=192; out=sys.argv[1]
# hue stops sampled around the shipped orb (angle in degrees, clockwise from 3 o'clock)
stops=[(0,(0x79,0x94,0xed)),(45,(0x60,0xa6,0xd0)),(90,(0x54,0xb4,0xab)),(130,(0x48,0xa8,0xb0)),(165,(0x46,0x8e,0xd2)),(200,(0x6f,0x95,0xf0)),(240,(0xb8,0xb2,0xf7)),(280,(0xa0,0x94,0xf0)),(320,(0x8d,0x94,0xef)),(360,(0x79,0x94,0xed))]
A=np.array([s[0] for s in stops],float);C=np.array([s[1] for s in stops],float)
def conic(ang):
    a=ang%360;r=np.interp(a,A,C[:,0]);g=np.interp(a,A,C[:,1]);b=np.interp(a,A,C[:,2]);return np.stack([r,g,b],-1)
ss=3;W=SZ*ss
y,x=np.mgrid[0:W,0:W]+.5;cx=cy=W/2
for i in range(N):
    t=i/N; rot=360*t; breathe=1+0.035*math.sin(2*math.pi*t*2)
    R=W*0.415*breathe
    dx=x-cx;dy=y-cy;d=np.hypot(dx,dy)
    ang=np.degrees(np.arctan2(dy,dx))-rot
    col=conic(ang)
    # soft centre: blend toward a lighter mix near the middle so the seam doesn't pinch
    m=np.clip(d/(R*0.55),0,1)[...,None];col=col*(0.55+0.45*m)+np.array([150,160,245])*(0.45*(1-m))
    # edge shading for depth
    e=np.clip((d/R-0.72)/0.28,0,1)[...,None];col=col*(1-0.28*e)+np.array([40,60,150])*0.28*e
    # highlight at upper-left, fixed while the colours turn
    hx,hy=cx-R*0.38,cy-R*0.42;h=np.exp(-((x-hx)**2+(y-hy)**2)/(2*(R*0.2)**2))[...,None]
    col=col*(1-0.75*h)+255*0.75*h
    a=np.clip((R-d)/ss+0.5,0,1)  # anti-aliased disc
    # outer glow
    g=np.exp(-np.maximum(d-R,0)/(R*0.09))*0.22*(d>=R-ss)
    alpha=np.maximum(a,g*(1-a))
    rgb=np.where(a[...,None]>0,col,np.array([40,85,255]))
    img=np.dstack([np.clip(rgb,0,255),alpha*255]).astype(np.uint8)
    Image.fromarray(img,'RGBA').resize((SZ,SZ),Image.LANCZOS).save('%s/o%02d.png'%(out,i),optimize=True)
