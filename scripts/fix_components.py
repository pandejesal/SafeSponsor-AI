import pathlib

files = [
    r'C:\Users\DELL\Desktop\SafeSponsor_AI\components\PlatformPage.tsx',
    r'C:\Users\DELL\Desktop\SafeSponsor_AI\components\TeaserWidget.tsx',
]

for fp in files:
    p = pathlib.Path(fp)
    if not p.exists():
        print(f'SKIP: {p.name} not found')
        continue
    t = p.read_text('utf-8')
    c = t.count("background: 'white'")
    t = t.replace("background: 'white'", "background: 'var(--card-bg)'")
    c2 = t.count("borderColor: 'rgba(15,27,46,0.08)'")
    t = t.replace("borderColor: 'rgba(15,27,46,0.08)'", "borderColor: 'var(--card-border)'")
    p.write_text(t, 'utf-8')
    print(f'{p.name}: fixed {c} white + {c2} border colors')
