#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('st2110-rds-manager/frontend/src/pages/RDSManagement.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace escaped template literals with proper template literals
content = content.replace(r'\`', '`')
content = content.replace(r'\$', '$')

with open('st2110-rds-manager/frontend/src/pages/RDSManagement.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('RDSManagement.tsx template literals fixed successfully')
