import pathlib
import glob

# Fix dashboard pages
files = glob.glob(r'C:\Users\DELL\Desktop\SafeSponsor_AI\app\dashboard\*.tsx')

for fp in files:
    p = pathlib.Path(fp)
    t = p.read_text('utf-8')
    c1 = t.count("background: 'white'")
    t = t.replace("background: 'white'", "background: 'var(--card-bg)'")
    c2 = t.count("borderColor: 'rgba(15,27,46,0.08)'")
    t = t.replace("borderColor: 'rgba(15,27,46,0.08)'", "borderColor: 'var(--card-border)'")
    c3 = t.count("borderColor: 'rgba(15,27,46,0.10)'")
    t = t.replace("borderColor: 'rgba(15,27,46,0.10)'", "borderColor: 'var(--card-border)'")
    if c1 or c2 or c3:
        p.write_text(t, 'utf-8')
        print(f'{p.name}: fixed {c1} white + {c2+c3} borders')
    else:
        print(f'{p.name}: clean')
