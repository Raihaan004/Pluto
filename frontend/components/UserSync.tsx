"use client"

import { useUser, useOrganization } from "@clerk/nextjs"
import { useEffect } from "react"
import axios from "axios"

export function UserSync() {
  const { user, isLoaded } = useUser()

  useEffect(() => {
    if (isLoaded && user) {
      const syncUser = async () => {
        try {
          await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
            clerk_id: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            first_name: user.firstName,
            last_name: user.lastName,
            image_url: user.imageUrl,
            // We handle organization separately via our custom license verification
          })
        } catch (error) {
          console.error("Failed to sync user:", error)
        }
      }
      syncUser()
    }
  }, [isLoaded, user])

  return null
}
