import { ReactNode } from 'react'
import Header from './Header'


type Props = {
  children?: ReactNode
}
const Layout: React.FC<Props> = ({ children }) => {
  return (
    <div
      // className="flex min-h-screen flex-col"
      className="flex min-h-screen flex-col overflow-x-hidden"
    >
      <Header />
      <main className="flex-1 w-full pt-14">
        {children}
      </main>
     
      {/* Modal Root - Container for modals to render at root level */}
      <div id="modal-root" className="modal-root-container" style={{ position: 'static' }} />
    </div>
  )
}

export default Layout
