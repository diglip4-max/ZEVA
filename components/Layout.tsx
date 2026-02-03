import { ReactNode } from 'react'
import Header from './Header'
import Footer from './Footer'


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
      <main className="flex-1 w-full overflow-y-auto pt-14">
        {children}
      </main>
     
      <Footer />
    </div>
  )
}

export default Layout
