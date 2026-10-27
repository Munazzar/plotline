"""Frame checks for Plotlines screen recordings and screenshots (OpenCV + PyAV).

  python frames.py video rec.mp4 outdir  x y w h  hx hy hw hh
      Walks every frame. In the book area (x y w h, device px) flags:
        blank   - the page area is one flat colour (nothing painted)
        flicker - a frame that differs a lot from both neighbours while the neighbours match each other
      The header area (hx hy hw hh) is checked for one-frame flicker too.
      Each flag saves prev|frame|next side by side to outdir and prints one line. Exit 1 if anything was flagged.
  python frames.py diff a.png b.png x y w h
      Mean absolute difference of two screenshots in that area (0 = identical). Prints the number.
"""
import sys, os
import numpy as np, cv2

S = 4  # analyse at 1/4 size: fast, and still sees a one-frame glitch
# Since 1.60.0 a page turns in as plain paper and gets its words when it lands, so blank pages are expected: BLANK_OK=1
BLANK_OK = os.environ.get('BLANK_OK') == '1'


def crop(img, x, y, w, h, s=1):
    return img[y // s:(y + h) // s, x // s:(x + w) // s]


def mad(a, b):
    return float(np.mean(cv2.absdiff(a, b)))


def video(path, out, box, hbox):
    import av
    os.makedirs(out, exist_ok=True)
    small, full, ts = [], [], []
    with av.open(path) as c:
        for f in c.decode(video=0):
            img = f.to_ndarray(format='bgr24')
            full.append(cv2.resize(img, (img.shape[1] // 2, img.shape[0] // 2)))
            small.append(cv2.cvtColor(cv2.resize(img, (img.shape[1] // S, img.shape[0] // S)), cv2.COLOR_BGR2GRAY))
            ts.append(float(f.time or 0))
    n, flags = len(small), []
    B = [crop(g, *box, s=S) for g in small]
    H = [crop(g, *hbox, s=S) for g in small]
    for k in range(n):
        if not BLANK_OK and float(B[k].std()) < 2.0:
            flags.append((k, 'blank', 'book area is one flat colour (std %.2f)' % B[k].std()))
        if 0 < k < n - 1:
            for name, A, lim in (('flicker', B, 6.0), ('header-flicker', H, 6.0)):
                a, b, c = mad(A[k - 1], A[k]), mad(A[k], A[k + 1]), mad(A[k - 1], A[k + 1])
                if a > lim and b > lim and c < 0.35 * min(a, b):
                    flags.append((k, name, 'jumps %.1f/%.1f from neighbours that differ only %.1f' % (a, b, c)))
    for k, kind, why in flags:
        trio = [full[max(0, k - 1)], full[k], full[min(n - 1, k + 1)]]
        p = os.path.join(out, '%s-f%05d-%.2fs.png' % (kind, k, ts[k]))
        cv2.imwrite(p, np.hstack(trio))
        print('%s frame %d at %.2fs: %s -> %s' % (kind, k, ts[k], why, p))
    print('frames %d, flagged %d' % (n, len(flags)))
    return 1 if flags else 0


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[0] == 'video':
        nums = list(map(int, a[3:11]))
        sys.exit(video(a[1], a[2], nums[:4], nums[4:]))
    if a[0] == 'diff':
        x, y, w, h = map(int, a[3:7])
        A, B = (cv2.imread(p, cv2.IMREAD_GRAYSCALE) for p in a[1:3])
        print('%.2f' % mad(crop(A, x, y, w, h), crop(B, x, y, w, h)))
