/** Shield sonrası bariz FiveM kırılmalarını yakala */
export function fivemSanityIssues(code: string): string[] {
  const issues: string[] = []

  if (/exports\[['"]{2}\]/.test(code)) {
    issues.push('Boş exports[...] resource adı')
  }
  if (/RegisterNUICallback\s*\(\s*['"]{2}/.test(code)) {
    issues.push('Boş NUI callback adı')
  }
  if (/RegisterNetEvent\s*\(\s*['"]{2}/.test(code)) {
    issues.push('Boş RegisterNetEvent adı')
  }

  return issues
}
