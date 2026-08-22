import pathlib

p = pathlib.Path(r'C:\Users\DELL\Desktop\SafeSponsor_AI\app\page.tsx')
t = p.read_text(encoding='utf-8')

# 1. Fix hardcoded background: 'white' to use CSS var
count = t.count("style={{ background: 'white'")
t = t.replace("style={{ background: 'white'", "style={{ background: 'var(--card-bg)'")
print(f'Replaced {count} hardcoded white backgrounds')

# 2. Fix broken isDark classes: bg-[var(--ink)]-500/15 -> bg-[var(--paper-100)]
t = t.replace("bg-[var(--ink)]-500/15 text-[var(--ink)]-300 border-[var(--ink)]-500/30",
              "bg-[var(--paper-100)] text-[var(--ink-600)] border-[var(--paper-200)]")
print('Fixed broken isDark badge class')

# 3. Fix broken isDark text classes
t = t.replace("isDark ? \"text-[var(--ink)]-400\" : \"text-blue-900\"",
              "isDark ? 'text-[var(--ink-600)]' : 'text-blue-900'")
print('Fixed broken isDark icon color class')

# 4. Fix the dossier preview cards border colors for dark mode
t = t.replace("borderColor: 'rgba(15,27,46,0.10)', boxShadow: 'var(--shadow-md)' }}",
              "borderColor: 'var(--card-border)', boxShadow: 'var(--shadow-md)' }}")
print('Fixed dossier preview border colors')

# 5. Fix recommendation box hardcoded white
t = t.replace("style={{ background: 'var(--card-bg)', borderColor: 'rgba(15,27,46,0.08)' }}",
              "style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}")
print('Fixed card border colors')

p.write_text(t, encoding='utf-8')
print('Done')
