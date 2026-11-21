import { useState, type ReactElement } from 'react'
import { Pagination } from '@/shared/ui/primitives/pagination'
import { Specimen, Specimens } from '../specimen'

export const meta = { group: 'Navigation', title: 'Pagination' }

export default function PaginationSection(): ReactElement {
  const [page, setPage] = useState(5)
  const [few, setFew] = useState(1)
  return (
    <Specimens>
      <Specimen label={`many pages (page ${page} of 20)`}>
        <Pagination page={page} pageCount={20} onPageChange={setPage} />
      </Specimen>
      <Specimen label="few pages, first page">
        <Pagination page={few} pageCount={3} onPageChange={setFew} />
      </Specimen>
      <Specimen label="RTL">
        <div dir="rtl">
          <Pagination page={2} pageCount={4} onPageChange={() => {}} />
        </div>
      </Specimen>
    </Specimens>
  )
}
