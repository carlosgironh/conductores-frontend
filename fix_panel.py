import os, re

path = r'C:\Proyectos_Git\conductores-frontend\panel-admin.html'
with open(path, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Remove all duplicate injected CSS blocks (everything between second </style> tag onwards that are duplicates)
# Find the first </style> occurrence
first_style_end = content.index('</style>')

# Find if there is a second </style> that has our injected mobile CSS
second_idx = content.find('</style>', first_style_end + 1)
if second_idx != -1:
    # Remove everything from first </style> to second </style> EXCLUSIVE of the first
    # i.e., remove the duplicated block which starts right after </style> on line 1692
    chunk_to_remove = content[first_style_end + len('</style>'):second_idx + len('</style>')]
    print(f"Removing {len(chunk_to_remove)} chars of duplicate CSS")
    content = content[:first_style_end + len('</style>')] + content[second_idx + len('</style>'):]
else:
    print("No duplicate found")

# Also remove duplicate button if it exists
btn_count = content.count('<button class="mobile-menu-btn"')
print(f"Mobile menu buttons found: {btn_count}")
if btn_count > 1:
    idx1 = content.index('<button class="mobile-menu-btn"')
    idx2 = content.index('<button class="mobile-menu-btn"', idx1 + 1)
    end2 = content.index('</button>', idx2) + len('</button>') + 1
    content = content[:idx2] + content[end2:]
    print("Removed duplicate button")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done. Total size:", len(content))
