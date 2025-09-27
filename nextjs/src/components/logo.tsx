import Image, { type ImageProps } from "next/image";

export const Logo = (props: Omit<ImageProps, "src" | "alt">) => {
  return (
   <Image src="/logo.png" width={50} height={50} alt="Logo" {...props} />
  );
};
