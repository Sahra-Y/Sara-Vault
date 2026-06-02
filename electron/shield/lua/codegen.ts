// luaparse AST nodes are wider at runtime than @types/luaparse
type AstNode = { type: string; [key: string]: unknown }

function escapeString(value: string, quote: '"' | "'"): string {
  const q = quote
  return (
    q +
    value
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(new RegExp(q, 'g'), `\\${q}`) +
    q
  )
}

function joinStatements(nodes: AstNode[], sep = ''): string {
  return nodes.map((n) => generate(n)).join(sep)
}

export function generate(node: AstNode): string {
  switch (node.type) {
    case 'Chunk':
      return joinStatements(node.body as AstNode[], '\n')

    case 'Identifier':
      return String(node.name)

    case 'NumericLiteral':
      return String(node.value)

    case 'BooleanLiteral':
      return String(node.raw ?? node.value)

    case 'NilLiteral':
      return 'nil'

    case 'VarargLiteral':
      return '...'

    case 'StringLiteral': {
      const raw = node.raw
      if (typeof raw === 'string' && raw.length > 0) {
        const value = node.value
        if (value === null || value === undefined) return raw
      }
      const quote =
        typeof raw === 'string' && raw.startsWith("'") ? "'" : '"'
      return escapeString(String(node.value ?? ''), quote)
    }

    case 'UnaryExpression': {
      const op = String(node.operator)
      const inner = generate(node.argument as AstNode)
      if (op === 'not') return `not ${inner}`
      return `${op}${inner}`
    }

    case 'BinaryExpression':
      return `${generate(node.left as AstNode)} ${node.operator} ${generate(node.right as AstNode)}`

    case 'LogicalExpression':
      return `${generate(node.left as AstNode)} ${node.operator} ${generate(node.right as AstNode)}`

    case 'TableKeyString': {
      const key = node.key as AstNode
      if (key.type === 'Identifier') {
        return `${String(key.name)} = ${generate(node.value as AstNode)}`
      }
      return `[${generate(key)}] = ${generate(node.value as AstNode)}`
    }

    case 'TableKey':
      return `[${generate(node.key as AstNode)}] = ${generate(node.value as AstNode)}`

    case 'TableValue':
      return generate(node.value as AstNode)

    case 'TableConstructorExpression': {
      const fields = (node.fields as AstNode[]).map((f) => generate(f)).join(', ')
      return `{${fields}}`
    }

    case 'MemberExpression': {
      const base = generate(node.base as AstNode)
      const indexer = String(node.indexer)
      const ident = node.identifier as AstNode
      if (ident.type === 'Identifier') return `${base}${indexer}${ident.name}`
      return `${base}${indexer}${generate(ident)}`
    }

    case 'IndexExpression':
      return `${generate(node.base as AstNode)}[${generate(node.index as AstNode)}]`

    case 'CallExpression': {
      const base = generate(node.base as AstNode)
      const args = (node.arguments as AstNode[]).map((a) => generate(a)).join(', ')
      return `${base}(${args})`
    }

    case 'CallStatement':
      return `${generate(node.expression as AstNode)}`

    case 'FunctionDeclaration': {
      const ident = node.identifier as AstNode | null
      const name =
        ident && ident.type === 'Identifier'
          ? String(ident.name)
          : ident
            ? generate(ident)
            : ''
      const params = (node.parameters as AstNode[])
        .map((p) => (p.type === 'Identifier' ? String(p.name) : '...'))
        .join(', ')
      const body = joinStatements(node.body as AstNode[], '\n')
      const isLocal = node.isLocal ? 'local ' : ''
      return `${isLocal}function ${name}(${params})\n${body}\nend`
    }

    case 'FunctionExpression': {
      const params = (node.parameters as AstNode[])
        .map((p) => (p.type === 'Identifier' ? String(p.name) : '...'))
        .join(', ')
      const body = joinStatements(node.body as AstNode[], '\n')
      return `function(${params})\n${body}\nend`
    }

    case 'LocalStatement': {
      const vars = (node.variables as AstNode[]).map((v) => generate(v)).join(', ')
      const initList = node.init as AstNode[]
      const init = initList.length
        ? ' = ' + initList.map((i) => generate(i)).join(', ')
        : ''
      return `local ${vars}${init}`
    }

    case 'AssignmentStatement': {
      const vars = (node.variables as AstNode[]).map((v) => generate(v)).join(', ')
      const init = (node.init as AstNode[]).map((i) => generate(i)).join(', ')
      return `${vars} = ${init}`
    }

    case 'ReturnStatement': {
      const values = (node.arguments as AstNode[]).map((a) => generate(a)).join(', ')
      return values ? `return ${values}` : 'return'
    }

    case 'IfStatement': {
      const clauses = node.clauses as { condition?: AstNode; body: AstNode[] }[]
      let out = `if ${generate(clauses[0].condition!)} then\n${joinStatements(clauses[0].body, '\n')}\n`
      for (let i = 1; i < clauses.length; i++) {
        const clause = clauses[i]
        if (clause.condition) {
          out += `elseif ${generate(clause.condition)} then\n${joinStatements(clause.body, '\n')}\n`
        } else {
          out += `else\n${joinStatements(clause.body, '\n')}\n`
        }
      }
      out += 'end'
      return out
    }

    case 'WhileStatement':
      return `while ${generate(node.condition as AstNode)} do\n${joinStatements(node.body as AstNode[], '\n')}\nend`

    case 'RepeatStatement':
      return `repeat\n${joinStatements(node.body as AstNode[], '\n')}\nuntil ${generate(node.condition as AstNode)}`

    case 'ForNumericStatement': {
      const v = generate(node.variable as AstNode)
      const step = node.step as AstNode | undefined
      return `for ${v} = ${generate(node.start as AstNode)}, ${generate(node.end as AstNode)}${step ? `, ${generate(step)}` : ''} do\n${joinStatements(node.body as AstNode[], '\n')}\nend`
    }

    case 'ForGenericStatement': {
      const vars = (node.variables as AstNode[]).map((v) => generate(v)).join(', ')
      const iters = (node.iterators as AstNode[]).map((i) => generate(i)).join(', ')
      return `for ${vars} in ${iters} do\n${joinStatements(node.body as AstNode[], '\n')}\nend`
    }

    case 'DoStatement':
      return `do\n${joinStatements(node.body as AstNode[], '\n')}\nend`

    case 'BreakStatement':
      return 'break'

    case 'LabelStatement':
      return `::${(node.label as AstNode).name}::`

    case 'GotoStatement':
      return `goto ${(node.label as AstNode).name}`

    case 'Comment':
      return ''

    case 'EmptyStatement':
      return ''

    default: {
      const raw = (node as { raw?: string }).raw
      if (typeof raw === 'string' && raw.length > 0) return raw
      return ''
    }
  }
}

export function minify(code: string): string {
  return code
    .replace(/--\[\[[\s\S]*?\]\]/g, '')
    .replace(/--[^\n\r]*/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
