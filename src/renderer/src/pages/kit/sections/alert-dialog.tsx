import type { ReactElement } from 'react'
import { TriangleAlertIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/shared/ui/primitives/alert-dialog'
import { Button } from '@/shared/ui/primitives/button'
import { Guidance, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Overlays', title: 'Alert dialog' }

export default function AlertDialogSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        <Specimen label="destructive confirm">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete build</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-danger-subtle text-danger-text">
                  <TriangleAlertIcon />
                </AlertDialogMedia>
                <AlertDialogTitle>Delete “watchtower”?</AlertDialogTitle>
                <AlertDialogDescription>
                  builds/watchtower/ and its 14 versions will be deleted. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep build</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => toast('Build deleted')}>
                  Delete build
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Specimen>
        <Specimen label="sm, neutral">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">Discard changes</Button>
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Discard review notes?</AlertDialogTitle>
                <AlertDialogDescription>3 unsaved pins will be lost.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction>Discard</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Specimen>
      </Specimens>
      <Guidance>
        For decisions that cannot be undone. Focus starts on Cancel, outside clicks do nothing, Esc cancels.
        Title asks the question with the object’s name; the action button repeats the verb (“Delete build”),
        never “OK” or “Yes”.
      </Guidance>
    </div>
  )
}
