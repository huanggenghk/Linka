const ICP_NUMBER = '浙ICP备2026025427号-1'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-brand">Linka</div>
      <div className="footer-links">
        <a href="https://github.com/anthropics/linka" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        <a href="mailto:contact@linka.zone">联系我们</a>
      </div>
      <div className="footer-copyright">
        &copy; 2026 Linka
        <a className="footer-icp" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
          {ICP_NUMBER}
        </a>
      </div>
    </footer>
  )
}
