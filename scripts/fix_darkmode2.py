import pathlib

p = pathlib.Path(r'C:\Users\DELL\Desktop\SafeSponsor_AI\app\page.tsx')
t = p.read_text(encoding='utf-8')

# Fix remaining hardcoded border colors to use var(--card-border)
t = t.replace("borderColor: 'rgba(15,27,46,0.08)', boxShadow: 'var(--shadow-sm)'",
              "borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)'")
t = t.replace("borderColor: 'rgba(15,27,46,0.10)', boxShadow: 'var(--shadow-sm)'",
              "borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-sm)'")
t = t.replace("borderColor: 'rgba(15,27,46,0.12)', boxShadow: 'var(--shadow-md)'",
              "borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-md)'")
t = t.replace("borderColor: 'rgba(15,27,46,0.14)', color: 'var(--ink)'",
              "borderColor: 'var(--card-border)', color: 'var(--ink)'")
print('Fixed remaining hardcoded border colors')

p.write_text(t, encoding='utf-8')
print('Done')
