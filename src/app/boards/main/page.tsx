import { redirect } from "next/navigation"

export default async function BoardPage() {
    redirect("/issues")
}
