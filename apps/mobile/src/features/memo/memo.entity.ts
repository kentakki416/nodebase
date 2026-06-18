export class Memo {
  public id!: string
  public title!: string
  public body!: string
  public created_at!: string

  constructor(data: Memo) {
    Object.assign(this, data)
  }
}