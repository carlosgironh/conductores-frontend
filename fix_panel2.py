path = r'C:\Proyectos_Git\conductores-frontend\panel-admin.html'
with open(path, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Find the main content div or body right after header
# Add the hamburger button and sidebar ID just before the first dashboard/sidebar element
# First, check if button exists
if 'mobile-menu-btn' not in content.split('</style>')[1]:
    # Find body tag to insert button
    body_idx = content.index('<body>')
    insert_pos = content.index('>', body_idx) + 1
    btn_html = '\n<button class="mobile-menu-btn" id="sidebarToggle" onclick="document.getElementById(\'adminSidebar\').classList.toggle(\'active\')" title="Menu">\n  &#9776;\n</button>\n'
    content = content[:insert_pos] + btn_html + content[insert_pos:]
    print("Hamburger button added")
else:
    print("Button already exists")

# Check if sidebar has id
if 'id="adminSidebar"' not in content:
    # Find the sidebar section in the body
    # The sidebar is likely a div with role or first major div after body
    # Let us look for Panel de Administracion header text to find the sidebar
    sidebar_marker = '<div class="sidebar">'
    if sidebar_marker in content:
        content = content.replace(sidebar_marker, '<div class="sidebar" id="adminSidebar">', 1)
        print("Added sidebar id")
    else:
        # Look for the navigation section
        nav_marker = 'Panel de Administraci'
        if nav_marker in content:
            idx = content.index(nav_marker)
            # Find containing div backwards
            div_start = content.rfind('<div', 0, idx)
            content = content[:div_start+4] + ' id="adminSidebar"' + content[div_start+4:]
            print("Added adminSidebar id from context")
        else:
            print("Could not find sidebar element")

# Update CSS to use the id for toggle
old_css = '.sidebar.active'
new_css = '.sidebar.active, #adminSidebar.active'
content = content.replace(old_css, new_css)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
