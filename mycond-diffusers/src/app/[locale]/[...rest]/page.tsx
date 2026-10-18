import { notFound } from "next/navigation";

/** Невідомі адреси всередині мовного розділу — на сторінку 404 цієї мови */
export default function CatchAll() {
  notFound();
}
