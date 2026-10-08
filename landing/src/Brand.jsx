export function Brand({ href = '/', className = '' }) {
  return <a href={href} className={`brand ${className}`.trim()} aria-label="MotoDoc home">
    <img src="/assets/motodoc-logo.png" alt="" width="42" height="31" /><span>MotoDoc</span>
  </a>;
}
