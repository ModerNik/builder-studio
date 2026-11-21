import type { ReactElement } from 'react'
import { MoreHorizontalIcon } from 'lucide-react'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/shared/ui/primitives/card'
import { IconButton } from '@/shared/ui/primitives/icon-button'
import { Guidance, LONG, Specimen, Specimens } from '../specimen'

export const meta = { group: 'Display', title: 'Card' }

export default function CardSection(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Specimens>
        <Specimen label="full" className="w-80">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Engine</CardTitle>
              <CardDescription>Bundled Python build engine</CardDescription>
              <CardAction>
                <IconButton label="Engine actions" size="icon-sm">
                  <MoreHorizontalIcon />
                </IconButton>
              </CardAction>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-sm text-fg-secondary">
              <Badge variant="success">Ready</Badge>
              <span className="font-mono tabular-nums">2.4.1</span>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm">
                Check again
              </Button>
            </CardFooter>
          </Card>
        </Specimen>
        <Specimen label="long title wraps" className="w-64">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>{LONG}</CardTitle>
              <CardDescription>Description</CardDescription>
            </CardHeader>
          </Card>
        </Specimen>
      </Specimens>
      <Guidance>Cards are flat at rest (border, no shadow). Never nest a card in a card.</Guidance>
    </div>
  )
}
