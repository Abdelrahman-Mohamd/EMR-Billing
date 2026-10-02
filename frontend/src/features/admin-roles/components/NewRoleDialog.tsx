import { useId, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid } from '@/components/ui/Field'
import { Form, FormField } from '@/components/ui/Form'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { Role } from '../model/role'
import { roleFormSchema, type RoleFormValues } from '../schemas/role-form'

/**
 * The prototype's New role dialog: a name, and the role whose permissions the
 * new one starts from — any role that is not global, the first chosen. The new
 * role is a custom one; its permissions are then set on the screen.
 */
export function NewRoleDialog({
  roles,
  onCreate,
  onClose,
}: {
  /** Every role: names must not repeat, and the non-global ones can be copied. */
  roles: readonly Role[]
  onCreate: (name: string, fromRoleId: string) => void
  onClose: () => void
}) {
  const formId = useId()
  const sources = roles.filter((role) => !role.isGlobal)
  const schema = useMemo(() => roleFormSchema(roles.map((role) => role.name)), [roles])
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', from: sources[0]?.id ?? null },
  })

  const onSubmit = (values: RoleFormValues) => {
    if (values.from === null) return
    onCreate(values.name, values.from)
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="New role"
      description="Adding a role is a data change, not a schema change."
      size="md"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary">
            Create role
          </Button>
        </>
      }
    >
      <Form id={formId} form={form} onSubmit={onSubmit}>
        <FormGrid>
          <FormField name="name" label="Role name" required span={12}>
            {(field) => <Input {...field} placeholder="Enter role name" autoComplete="off" />}
          </FormField>
          <FormField
            name="from"
            label="Start from"
            required
            span={12}
            info="The new role starts with this role’s permissions. Change them after it is created."
          >
            {(field) => (
              <Select
                value={typeof field.value === 'string' ? field.value : null}
                onChange={field.onChange}
                options={sources.map((role) => ({ value: role.id, label: `Copy of ${role.name}` }))}
                placeholder="Select a role"
              />
            )}
          </FormField>
        </FormGrid>
      </Form>
    </Dialog>
  )
}
