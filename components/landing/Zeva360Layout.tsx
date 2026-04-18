import React, { ReactNode } from "react";
import Zeva360Header from "./Zeva360Header";
import Zeva360Footer from "./Zeva360Footer";

type Props = {
  children?: ReactNode;
};

const Zeva360Layout: React.FC<Props> = ({ children }) => {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-gray-50">
      <Zeva360Header />
      <main className="flex-1 w-full pt-20">{children}</main>
      <Zeva360Footer />
    </div>
  );
};

export default Zeva360Layout;
