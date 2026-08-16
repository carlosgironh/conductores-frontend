import sys

path = r'C:\Proyectos_Git\conductores-frontend\panel-admin.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

css_addition = '''
  /* Mobile Sidebar Toggle */
  .mobile-menu-btn {
    display: none;
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    background: #8ac725;
    border: none;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
  .mobile-menu-btn i {
    color: #000;
    font-size: 24px;
  }
  
  @media (max-width: 768px) {
    .mobile-menu-btn {
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .sidebar {
      position: fixed;
      top: 0;
      left: -300px;
      transition: left 0.3s ease;
      z-index: 999;
      background: rgba(10, 18, 8, 0.95);
      backdrop-filter: blur(10px);
      width: 280px;
      box-shadow: 4px 0 20px rgba(0,0,0,0.5);
    }
    .sidebar.active {
      left: 0;
    }
    body {
      flex-direction: column;
    }
    .main-content {
      padding-top: 80px;
    }
    .stats-grid {
      grid-template-columns: 1fr;
    }
  }
'''

content = content.replace('</style>', css_addition + '</style>')

js_addition = '''
<button class="mobile-menu-btn" onclick="document.querySelector('.sidebar').classList.toggle('active')">
  &#9776;
</button>
'''

content = content.replace('<div class="sidebar">', js_addition + '<div class="sidebar">')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
