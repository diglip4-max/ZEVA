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
      <main
        className="w-full"
        // className="flex shrink-0 grow flex-col p-4 sm:p-6 md:p-8"
        // className="flex shrink-0 grow flex-col px-4 sm:p-1 md:p-1"
      >
        {children}
      </main>
     
      <Footer />
    </div>
  )
}

export default Layout
