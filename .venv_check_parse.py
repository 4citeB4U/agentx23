import ast
import sys
path = r"C:\Tools\Portable-VSCode-MCP-Kit\server.py"
try:
    with open(path, encoding='utf-8') as f:
        src = f.read()
    ast.parse(src)
    print('SUCCESS: server.py is syntactically sound.')
except SyntaxError as e:
    print('SYNTAX ERROR:', e)
    sys.exit(2)
except Exception as e:
    print('ERROR:', e)
    sys.exit(3)
